## 前置知识

本次实验涉及到

1. Chapter6 locking ，需要了解xv6锁的机制和具体运用方式
2. Chapter 3.5 ，了解xv6内存分配流程和代码（lab memory allocator）
3. Chapter 8.1-8.3，对xv6文件系统有一定的了解（Buffer cache）


## 核心目的

通过重新设计xv6中内存分配器和文件系统，减少锁之间的相互竞争，以此提高性能，增强并行执行能力。

## 思路

从lab的划分来看，此次涉及到的核心有两个，一个是**内存分配器**，一个是**文件缓冲区**，要求我们重新设计原有的执行流程，减少锁之间的竞争，增强并行运行能力。既然要修改原有的设计，那起码要能够完整梳理原有机制的运行流程，以及为什么在原有流程下，会出现性能问题。


## Memory allocator

xv6是支持多cpu的操作系统，而原有设计下的内存分配器的核心数据结构（freelist），它是全局共用的数据结构，为了保障数据的一致性，任何对freelist的操作都需要先去获取对应的锁，然后才能执行分配或者回收操作，因此在多个线程同时操作freelist时，会彼此堵塞，在一个线程拿到锁后，其他线程需要自旋等待锁释放才能进行下一步操作，导致其他等待锁释放的线程浪费了大量的cpu时间。

为什么原有的freelist 需要一个大锁来保障数据的一致性，在多线程同时操作freelist时，如果没有锁来保障临界区的顺序性，就很有可能出现数据混乱，例如 thread1 将0x200的物理页回收，thread 1的代码刚好执行到第16行，同时另一个线程 thread 2 也执行到第16行 它要将0x300的物理页回收，此时两个线程拿到的kem.freelist 都是未回收之前的链表，两个线程同时回收不同的物理页，但是thread1 在 **kmem.freelist = r**;时比thread2 快了一点，这样就会导致0x200物理页回收失败，它被thread2 的0x300给覆盖掉了，从而内存分配器遗失了一个物理页。

```c
void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");

  // Fill with junk to catch dangling refs.
  memset(pa, 1, PGSIZE);

  r = (struct run*)pa;
  // 假如在回收过程中没有锁
  //acquire(&kmem.lock);
  r->next = kmem.freelist;
  kmem.freelist = r;
  //release(&kmem.lock);
}
```
所以需要锁来保障每个要回收或者分配的页都在freelist中被正确操作。

而锁也会导致对freelist的操作序列化，让并行运行变得没有意义，为了提高性能，需要重新设计内存分配器的锁机制。

1. 前文说到为什么需要锁，核心是freelist是全局共用的数据结构，如果每个cpu都有自己的freelist那么锁竞争的情况就会大大减少，只会在出现需要偷取其他cpu空闲freelist时会出现锁竞争。
2. 提高性能的关键指标是cpu的使用率，因此在当前cpu的freelist使用完毕时，需要去拿到其他cpu空闲的freelist。


### 修改freelist结构

此时是每个cpu都有自己的freelist ，因此要将原有的结构体变成数组。

```c
struct kmem{
  struct spinlock lock;
  struct run *freelist;
} kmems[NCPU];
```

同时在初始化内存分配器时也要分别初始化每个cpu的freelist。

```c
void
kinit()
{
  for (int i = 0; i < NCPU;i++){
    initlock(&kmems[NCPU].lock, "kmem");
  }
  freerange(end, (void *)PHYSTOP);
}
```
kfree释放当前cpu的内存页，调用获取当前cpuid的函数需要关闭中断。

```c
void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");

  // Fill with junk to catch dangling refs.
  memset(pa, 1, PGSIZE);

  r = (struct run*)pa;

  push_off();
  int hardid = cpuid();
  pop_off();

  acquire(&kmems[hardid].lock);
  r->next = kmems[hardid].freelist;
  kmems[hardid].freelist = r;
  release(&kmems[hardid].lock);
}
```
kalloc分配内存页，当前cpu没有空闲页时，需要去其他cpu中获取空闲页，这种情况是临界区，需要用锁来保证数据一致性。

```c
void *
kalloc(void)
{
  struct run *r;

  push_off();
  int hardid = cpuid();
  pop_off();


  acquire(&kmems[hardid].lock);
  r = kmems[hardid].freelist;
  if(r)
    kmems[hardid].freelist = r->next;
  else{
    // steal from other cpu freelist
    for (int i = 0; i < NCPU;i++){
      if(i == hardid)
        continue;
      acquire(&kmems[i].lock);
      if((r = kmems[i].freelist)){
        kmems[i].freelist = kmems[i].freelist->next;
        release(&kmems[i].lock);
        break;
      }
      release(&kmems[i].lock);
    }
  }
  release(&kmems[hardid].lock);

  if(r)
    memset((char*)r, 5, PGSIZE); // fill with junk
  return (void*)r;
}
```

在最初调用kinit时，会将所有的内存页都添加到cpu0的freelist ，其他cpu会在运行时去偷取cpu0 freelist的内存页，或许在freerange时将所有内存页公平分配在各个cpu中，能增加一点性能？


## Buffer cache

### 原有设计

xv6的文件系统大致分为以下几个层次，而buffer cache是disk层的缓冲区，buffer cache主要有两个作用：

1. 缓存磁盘访问结果，减少对磁盘的访问提升文件读写效率（LRU）。
2. 同步文件读写请求，保证每个区块的磁盘在buffer cache中只有一个备份，并且同时只能有一个线程操作。



![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/fs.png#crop=0&crop=0&crop=1&crop=1&height=753&id=fFTeo&originHeight=363&originWidth=369&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=&width=765)

在 这个实验中，只简单描述关于buffer cache的内容，对于整个xv6的文件系统在后续的章节中再细说，首先要梳理出原有xv6对buffer cache的处理方式，以及该实验的要求。

buffer cache 由一个双向链表构成，在binit时初始化。

```c
struct {
  struct spinlock lock;
  struct buf buf[NBUF];

  // Linked list of all buffers, through prev/next.
  // Sorted by how recently the buffer was used.
  // head.next is most recent, head.prev is least.
  struct buf head;
} bcache;
```

原有流程中对buffer cache的主要操作涉及到三个函数 bread bwrite。

1. bread：返回指定块的缓存数据。
2. bwrite：将指定缓冲区的数据写入对于块的磁盘中。
3. belease：修改buf块的引用计数，如果为0，则添加到lru链表的头部。

这两个函数都涉及到对buffer cache的数据操作，为了保证数据一致性，必须要用锁来实现，在这其中主要有两把锁。

1. bcache.lock  buf链表中的锁，用来保证对buf链表的操作一致性，例如对链表的插入和单个buf块除了数据字段外的修改。
2. buf->lock 单个buf块的锁，用来保证buf块数据的一致性。

在执行bget时，会先获取bcache.lock 再获取对应buf.lock，获取bcache.lock，是因为bget中会更新buf块除数据外的其他字段信息，同时还会修改buf链表的顺序，获取buf->lock是需要保证在读取缓存块中，不会出现其他线程同时在更新缓存块内容的情况。

同时，通过双向链表，bcache内部就维护了一个lru（最近最少使用）链表，因此在bget未命中时，就可以直接通过该链表拿到最有可能空闲的buf块，减少对链表的遍历时间。

```c
static struct buf*
bget(uint dev, uint blockno)
{
  struct buf *b;

  acquire(&bcache.lock);

  // Is the block already cached?
  for(b = bcache.head.next; b != &bcache.head; b = b->next){
    if(b->dev == dev && b->blockno == blockno){
      b->refcnt++;
      release(&bcache.lock);
      acquiresleep(&b->lock);
      return b;
    }
  }

  // Not cached.
  // Recycle the least recently used (LRU) unused buffer.
  for(b = bcache.head.prev; b != &bcache.head; b = b->prev){
    if(b->refcnt == 0) {
      b->dev = dev;
      b->blockno = blockno;
      b->valid = 0;
      b->refcnt = 1;
      release(&bcache.lock);
      acquiresleep(&b->lock);
      return b;
    }
  }
  panic("bget: no buffers");
}
```

在brelse中，因为设计到对buf数据的修改因此要获取大锁bcache。
```c
void
brelse(struct buf *b)
{
  if(!holdingsleep(&b->lock))
    panic("brelse");

  releasesleep(&b->lock);

  acquire(&bcache.lock);
  b->refcnt--;
  if (b->refcnt == 0) {
    // no one is waiting for it.
    b->next->prev = b->prev;
    b->prev->next = b->next;
    b->next = bcache.head.next;
    b->prev = &bcache.head;
    bcache.head.next->prev = b;
    bcache.head.next = b;
  }
  
  release(&bcache.lock);
}
```


而调用bwrite时只需要获取到对应buf的buf->lock即可(因为bwrite只修改buf块中的数据不会更新buf的其他字段信息)。

```c
void
bwrite(struct buf *b)
{
  if(!holdingsleep(&b->lock))
    panic("bwrite");
  virtio_disk_rw(b, 1);
}
```


因此，在多线程同时执行文件操作时，需要等待获取了bcache.lock锁的线程释放后，才能进行下一步操作，特别是涉及到read和relese操作。所以在这种情况下锁的竞争会非常严重，导致性能下降。

### 重新设计

通过对原有流程的梳理，我们知道buffer cache的核心性能问题出现在对bcache.lock锁的竞争上。而且实验的需求也是消除多线程读取buf时的锁竞争，所以重新设计的要点就是消除锁竞争。

为了消除锁竞争需要重新设计buffer cache的数据结构，修改掉原有的双向链表设计，转为哈希表结构，按照实验提示将新的数据结构定义为有13个哈希桶的哈希表，每个哈希桶由链表构成，并且为了保证数据一致性每个哈希桶有对应的锁，通过将锁的使用更加细粒化（由一把大锁细分成13把小锁），这样就能大范围的降低锁竞争的概率。

那么根据以上分析以及实验提示可以简单罗列一下新设计的几个要点以及需要注意的地方：

1. 拆锁，将大锁拆为 13个哈希桶的小锁。
2. 去掉原有的lru双向链表改成依照时间先后顺序的新的数据结构。（如果还要维护lru链表那么在belease时，必然要获取大锁来保证数据一致性，这样会增加锁冲突的次数）
3. 新设计会增加锁的细粒度，要注意获取和释放锁的时机，不然会导致死锁。
4. 保证bget的brelese并行执行中的一致性（即单个buf块同一时间只能有一个线程操作）。



#### 时钟算法和LRU
上面说到，如果要维护lru这个双向链表那必然要在执行belese时获取大锁，因此我们需要更换一种新的算法和数据结构替换掉原有的lru双向链表。

Remove the list of all buffers (bcache.head etc.) and instead time-stamp buffers using the time of their last use (i.e., using ticks in kernel/trap.c). With this change brelse doesn't need to acquire the bcache lock, and bget can select the least-recently used block based on the time-stamps.

在实验提示中注意到时间戳这个关键词，并且提到bget可以通过时间来拿到最近最少使用的buf块，brelese不在需要大锁，通过查阅资料，发现时钟算法最适合这个场景。

[时钟页面置换](https://www.cnblogs.com/wingsless/p/12295246.html)算法，按照时钟页面置换算法的思路，我们将原有的bcache的双向链表置换为一个环形链表，维护一个当前指针（cur）指向节点（这个节点就是最近最少使用的buf块），如同时钟一样，按照刻度递进，在哈希桶未命中时，我们通过cur指针拿到最近最少使用的buf块，如果未使用（refcnt为0）就将其置为1，并放入未命中的哈希桶中，同时将cur 指向下一个buf块。

对于belese来说，因为取消了维护lru的双向链表，只需要关注释放buf的refcnt即可，因此brelse不再需要获取大锁只需要拿到对应的哈希桶锁，这样就减少了锁竞争的可能性，但是在操作环形链表的cur指针时，依然需要锁来保护。

通过上面的思路分析，得出两个方案：

#### 方案一：   

将所有buf块组成一个环形链表，然后通过结构体申明一个哈希表，每个哈希桶内的数据结构是链表，他们只是指针指向对应cache的buf块，如果发生buf块转移和消除，只需要修改哈希桶内的指针指向地址就可以了，这样设计结构最清晰和buf块的环形链表逻辑也不会形成耦合，但是我发现一个问题，在xv6的内核中，没有提供**malloc**和**free**这两个方法，因此无法在缓存未命中的情况下，动态的构造出一个新的哈希桶内的链表节点指向复用的buf块，并在belease的时候再释放掉生成的链表节点。

#### 方案二：   

构建指定数量的哈希桶，每个哈希桶有一个start指针，指向buf块，然后结构体buf有两个指针，一个next 指针构成时钟算法的环形链表，一个down指针，构成哈希桶内部的单向链表，首先在binit中将所有buf块构成一个环形链表，接着在发生缓存未命中时，修改哈希桶的start指针和所操作buf块内的down指针，来构成对应的数据结构，因为操作的都是固定数量的结构体，就不再需要动态的生成和释放内存了。


##### 拆锁和重新构建bcache

拆解原有的bcache结构，增加哈希表和一个头指针。

参考上一个lab thread中的pc.c，可以罗列出一个哈希表的结构。

```c
#define NBUCKET 13

struct hash {
  struct spinlock lock; // 每个哈希桶的锁
  struct buf *start; // 指向哈希桶开始链表的指针
};
```

首先将原有的bcache重新构建。

```c
struct 
{
  struct spinlock lock; // 大锁，用来保证未命中缓存时的互斥
  struct buf buf[NBUF];

  struct buf *head;// 指向 时钟链表的最近最少使用的buf块
  struct hash table[NBUCKET]; // 哈希表
} bcache;
```

同时需要修改原有的buf结构体。

```c
struct buf {
  int valid;   // has data been read from disk?
  int disk;    // does disk "own" buf?
  uint dev;
  uint blockno;
  struct sleeplock lock;
  uint refcnt;
  int bucket; // hashbucket index
  int bufno; // 自身编号，用于一些判断
  struct buf *next; // c-clock list next指针用来形成时钟算法的环形链表
  struct buf *down; // 哈希桶内的指针，用来指向哈希桶内的单向链表
  uchar data[BSIZE];
};
```

修改binit函数主要工作有两个

1. 初始化所有哈希桶内的锁。
2. 将所有buf块通过next指针构造成一个环形链表。

```c
void
binit(void)
{
  initlock(&bcache.lock, "bcache");

  // init all bucket lock
  for (int i = 0; i < NBUCKET; i++){
    initlock(&bcache.table[i].lock, "bucket");
  }
  // init c-clock list of buffers
  for (int j = 1; j <= NBUF; j++)
  {
    bcache.buf[j-1].next = &bcache.buf[j];
    if(j == NBUF){
      bcache.buf[j-1].next = &bcache.buf[0];
    }else{
      bcache.buf[j-1].next = &bcache.buf[j];
    }
    initsleeplock(&bcache.buf[j-1].lock, "buffer");
    bcache.buf[j-1].bucket = -1;
    bcache.buf[j-1].bufno = j-1;
  }
  bcache.head = &bcache.buf[0];
}
```


##### bget 结构

在新的bget函数中，其主要功能还是和原函数一致，不过多了锁的添加和结构修改而已。由于锁的细粒度更小了，相对于之前的bget函数需要更加注意死锁和临界区。

1. 根据区号查找缓存。
2. 如果未命中缓存，则去时钟链表中拿到最近最少使用的缓冲块。

首先是如何查找新的哈希表拿到对应的buf，原有bget中bcache是一个双向链表，可以通过遍历的方式拿到对应的buf，而在哈希表这种数据结构中一般是通过某种对应关系计算出对应哈希桶（ y=f(x) ）因此要确认对于哈希表bcache要用何种映射关系去计算对应的哈希桶。

bget函数有两个参数一个是设备号，一个是区块号，在xv6文件系统中只支持一个设备，那么散列函数的重点自然就是区块号了，既然是编号那就肯定有它的范围，选择一个素数（13）让区块号对这个素数取余就可以将所有区块较为均匀的分散在13个不同的哈希桶中，这就是bcache哈希表的散列函数。

根据这个散列函数增加一个宏，这个宏可以将区块号转化为对应的哈希表索引。

```c
#define GETHASH(b) ((b) % NBUCKET)
```

但是我们同时注意到实验需求是要尽量满足时间局部原理的，也就是说在当前哈希桶无对应buf块时需要去拿到一块最近最少使用的buf块，同时在当前哈希桶有对应buf块时，需要将该buf块提升到该哈希桶的顶端，也能减少哈希桶内链表的遍历时间。

```c
static struct buf*
bget(uint dev, uint blockno)
{
  ....
  // Is the block already cached?
  while(cur != NULL){
    b = cur;
    if (b->blockno == blockno && b->dev == dev)
    {
      b->refcnt++;
      // move linklist
      if(pre != NULL){
        pre->down = pre->down->down; 
      }
      if(cur != start){
        cur->down = start;
        bcache.table[index].start = cur;
      }
      release(&bcache.table[index].lock);
      acquiresleep(&b->lock);
      return b;
    }
    pre = cur;
    cur = cur->down;
  }

  // Not cached.
  // Recycle the least recently used (LRU) unused buffer.

  panic("bget: no buffers");
}
```

在未命中缓存时，需要到时钟环形链表中获取空闲的buf块。即遍历这个环形链表。

```c
  for (b = bcache.head->next; b != bcache.head; b = b->next)
  {
    ....
  }
```


##### 锁的使用

在当前方案中，一共有两种锁。

1. 大锁，bcache  这个锁用来保证缓存未命中时只能有一个线程操作时钟链表。
2. 哈希桶锁，bucket 这个锁用来保证哈希桶内链表的数据一致性，以及保证对buf块结构的一致性。


初步按照这个方法梳理好代码后，出现了死锁情况，

具体表现为 

- 线程一 拿到对应哈希桶锁 但是等待 大锁bcache
- 线程二 拿到大锁 bcache 但是等待 已经被线程一拿到得哈希桶锁
- 线程三 等待获取已被线程一拿到得哈希桶锁
- 即 b 偷 a 得时候  a 也在偷 b

因此三个线程相互阻塞，导致死锁，要解决死锁，就要保障在偷取过程中，没有其他线程持有任何索引下得哈希桶的锁，同时要保障偷取buf块时 只有一个线程再进行，不能并行的去偷。

修改步骤：

1. 保障代码获取大锁bcache时，所有哈希桶的锁都处于释放状态。
2. 保障同一时间只能有一个线程在操作时钟链表。
3. 同时对于buf块字段的修改要特别注意，因为原有设计中，是直接通过大锁解决的，现在需要更细粒度的锁减少冲突和保证一致性。

因为需要在获取大锁前释放掉所有哈希桶的锁，当所有哈希桶锁被释放后，存在当前线程在释放完bucket锁后，获取bcache和再次获取bucket前，其他线程更新了当前哈希桶内的链表数据，所以在获取了bcache和bucket锁后，需要再次检查哈希桶内的数据，是否已经有了缓存。

```c
  ....
  acquire(&bcache.table[index].lock);
  struct buf *start = bcache.table[index].start;
  struct buf *cur = start;
  struct buf *pre = NULL;
  // Is the block already cached?
  while(cur != NULL){
    // 检查是否存在缓存
  }
  // 获取bcache之前释放掉bucket 避免死锁
  release(&bcache.table[index].lock);

  // Not cached.
  acquire(&bcache.lock);
  // 再次获取bucket锁.
  acquire(&bcache.table[index].lock);

  start = bcache.table[index].start;
  cur = start;
  pre = NULL;
  // 再次检查在释放了bucket锁后是否被其他线程更新
  // 只有再次检查还未命中时，去拿时钟链表中空闲的buf
  while(cur != NULL){
    
  }
  

```

缓存未命中时。

```c
  for (b = bcache.head->next; b != bcache.head; b = b->next)
  {
    int bindex = b->bucket;
    if (bindex != index && bindex > - 1)
      acquire(&bcache.table[bindex].lock);
    if(b->refcnt == 0 ){
      // steal from other hash list
      if(bindex > -1){
 		.....
        while(bcur != NULL ){
          // 操作链表避免被偷取的哈希桶内的链表结构乱掉
        }
      }

      b->dev = dev;
      b->blockno = blockno;
      b->valid = 0;
      b->refcnt = 1;
      b->bucket = index; 
      
      // c-clock head point
      bcache.head = b;
      // modify cur bucket start pointer
      if(b != start)
        b->down = start;
      bcache.table[index].start = b;

      if (bindex != index && bindex > - 1)
        release(&bcache.table[bindex].lock);
      release(&bcache.table[index].lock);
      release(&bcache.lock);
      acquiresleep(&b->lock);
      return b;
    }
    if (bindex != index && bindex > - 1)
      release(&bcache.table[bindex].lock);
  }

```

对于brelse和bpin bunpin 只需要对refcnt操作时用哈希桶锁保证互斥即可。

```c
acquire(&bcache.table[b->bucket].lock);
  b->refcnt--;
release(&bcache.table[b->bucket].lock);
```

##### 一致性保证

这个实验中，其实基本思路在实验说明和提示中已经讲的很明白了，然而在尝试过程中，发现经常有小几率出现测试用例失败，再连续跑了几次usertests后，会有概率出现测试失败的情况，排查下来，根本还是在于对buf块信息的一致性没有做到很好的保障！

最开始我只准备将大锁bcache细化成bucketlock（13个哈希桶的锁）即可，以这个粒度的锁作为操作一致性提供保障，但是，在一些情况下仍然会出现竞态条件。

首先来梳理一下 bget和brelese可能存在的竞态条件。

bget中存在两种情况：

1. bget命中哈希桶内的buf，修改buf块的refcnt。
2. bget未命中缓存，去时钟链表中获取空闲的buf块，修改空闲buf块的对应字段。此时该空闲的buf块可能还存在于其他哈希桶内，也有可能存在在当前的哈希桶。

brelse

1. 修改指定buf块的refcnt。

这两个函数是可以并行执行的，他们彼此之间存在竞态条件，即对buf块信息的修改，特别是refcnt字段，会影响到后续函数的一系列判断。

例如，bget命中了缓存，在未返回时，同时被brelse释放，然后又被其他线程当作空闲buf块放入自己的哈希桶中。

大多数情况下，可以通过提前获取哈希桶的锁形成互斥，但是在遍历时钟环形链表中，无法提前知道现在遍历的buf块属于那个哈希桶或者本身就是游离在哈希桶之外的，因此无法提前获取对应的哈希桶的锁，只有在获取到对应信息后，才能进一步去拿锁，但是就在这个过程中，就存在一定概率让其他线程先拿到这个空闲的buf块，然后导致运行错误。

```c
  for (b = bcache.head->next; b != bcache.head; b = b->next)
  {
 	
    if(b->refcnt == 0) {
      // steal from other hash list
      if(b->bucket > -1 ){
        if(b->bucket != index)
          // 不能在判断buf块信息前就获取锁，导致出现竞争条件。
          acquire(&bcache.table[b->bucket].lock);
          .....
```

例如buf 1 当前是空闲的并且属于第2个哈希桶，此时线程一执行bget 该区块编号属于第4个哈希桶，未命中缓存，代码执行到上面片段中的第7行，此时b就是 buf 1，同时在线程一执行到第7行时，线程二执行bget 并且区块号属于第2个哈希桶，刚好命中buf 1 并修改了buf 1 的信息，然后线程一接着执行，此时出现错误，因为buf 1 不在是一个空闲块了。

所以要去掉这个竞态条件，就需要更改判断的顺序，让b->refcnt的判断放在获取对应的哈希桶锁之后。

```c
  for (b = bcache.head->next; b != bcache.head; b = b->next)
  {
    int bindex = b->bucket;
    // 先于b->refcnt拿到哈希桶的锁，因为存在空闲的buf处于当前的哈希桶中，导致重复获取锁
    // 加上判断
    if (bindex != index && bindex > - 1)
      acquire(&bcache.table[bindex].lock);
    if(b->refcnt == 0 ){
      // steal from other hash list
      if(bindex > -1){
```


##### 梳理锁的使用

前面可能相对较乱，这里总结一下bget中锁的使用和目的。

1. 第一次检查缓存是否命中，获取对应的bucket锁，保证数据一致
2. 为了避免死锁出现，在获取bcache大锁时，释放掉bucket锁
3. 在获取了bcache和bucket锁后再次检查缓存是否有在释放了bucket后被更新
4. 缓存未命中时，先拿到对应的bucket锁再检查和更新，有可能空闲的buf块属于当前的bucket，所以需要判断
5. 缓存未命中时，会持有bcache大锁，这个大锁保证了只有一个线程在操作时钟链表。在持有bcache大锁的同时需要获取bucket锁，bucket锁用来保证哈希桶内数据的一致性。

```c
static struct buf*
bget(uint dev, uint blockno)
{
  struct buf *b;
  int index = GETHASH(blockno);
  acquire(&bcache.table[index].lock);
  ....
  // Is the block already cached?
  while(cur != NULL){
    ....
  }
  release(&bcache.table[index].lock);

  // Not cached.
  // Recycle the least recently used (LRU) unused buffer.
  acquire(&bcache.lock);

  acquire(&bcache.table[index].lock);

  ....
  // recheck is the block already cached?
  while(cur != NULL){
    ....
  }


  for (b = bcache.head->next; b != bcache.head; b = b->next)
  {
    int bindex = b->bucket;
    if (bindex != index && bindex > - 1)
      acquire(&bcache.table[bindex].lock);
    if(b->refcnt == 0 ){
      // steal from other hash list
      if(bindex > -1){
        ....
        while(bcur != NULL ){
          ....
        }
      }
      ....
      if (bindex != index && bindex > - 1)
        release(&bcache.table[bindex].lock);
      release(&bcache.table[index].lock);
      release(&bcache.lock);
      acquiresleep(&b->lock);
      return b;
    }
    if (bindex != index && bindex > - 1)
      release(&bcache.table[bindex].lock);
  }

  release(&bcache.table[index].lock);

  panic("bget: no buffers");
}
```


## 总结

buffer cache的难度有点出乎我的意料，在完成后，对于临界区和竞争条件的判断直觉有了很大的增长，在多线程运行中，更加细粒度的锁，可能带来更多逻辑上的负担，因为在尽可能保证性能并行的基础上要尽可能减少锁的使用，而又要保证数据的一致性。这就代表着需要对各个情况下代码的执行流程很有了解才可以，写出又有性能又有正确性的代码。

这篇文章数字可能有些多，逻辑也存在一定的混乱，因为我是按照我做题时的思路，边做边写的，结构上不是那么的明确。后续可能需要再整理一下。











