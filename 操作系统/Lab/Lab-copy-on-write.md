## 前置知识

本次实验目的是实现copy-on-write（写时复制）的功能，这个功能作为性能优化技巧，广泛应用在各个角落，xv6的架构同现代操作系统是基本一致的，因此也可以实现该功能，此次lab 涉及到页表的分配和映射，trap流程的修改，建议首先阅读** chapter 3** 和**chapter 4 **清晰页表是如何和物理页映射，以及fork，exec调用流程。其实该lab 和上一个 lazy allocate 是有很多相似之处。

## 核心目的

修改原有xv6的fork机制，实现父子进程对同一地址空间做修改时，进行写时分配，提升系统性能和利用率。

## 思路

首先明白什么是cow（copy-on-write），在原有xv6中，fork系统调用，会在分配子进程的过程中，将父进程的页表复制一份，相当于是将父进程所拥有的内存空间对应的数据进行一次全量拷贝，而在实际场景中，这会带来巨大的性能消耗和浪费，因为子进程多数情况下只会修改小部分父进程中的数据，并且在很多场景中（例如在shell中执行系统调用），通常fork出一个子进程，然后马上执行exec函数，而exec函数会又再重新分配一个页表并将之前进程中的页表释放掉，也就是说，在fork后执行exec，完全不会使用到父进程内存空间中的数据，还要消耗cpu时间释放之前分配的页表。

而copy-on-write机制中，fork执行时不再将父进程的页表全量拷贝，而是让子进程的页表指向父进程页表中的物理页，并同时把父子进程中pte指针的权限设置为不可写（~PTE-W），在不可写权限限制下，如果出现父子进程需要修改内存中的值，就会触发page fault，而该错误可以在trap中被捕获，在捕获函数中再动态复制对应的引用页即可（需要将pte的指向修改为新拷贝的页）。通过这个技巧，可以避免大多数情景下的无效分配，提高性能。按照这个流程，拆分修改步骤。

1. 修改**uvmcopy**函数，不再分配新的物理页给子进程，而是直接拷贝父进程的页表，并同时将flag设置为不可写。
2. 修改trap流程，在**usertrap**函数中捕获page fault。
3. 在捕获函数中进行该地址所属物理页的复制和分配，重置进程pte指针到新的页，并修改权限为可写。

大致流程如上，而在这三步中，还有许多细节需要注意。

1. 内存的分配释放，按照cow的机制，最开始的进程中的页是独立于父子进程之外的，并且可能出现再次调用fork的情况，那么何时回收该页，这步需要由引用计数来确定，而且在修改引用计数时，要不要考虑可以出现中断的情况。
2. 引用计数机制如何实现，以及保证正确计数。

## 解决步骤

关于usertrap和trap的解释可以参考lab lazy章节，这里就不赘述了。

### 增加物理页的引用计数机制

按照lab提示，我们需要建立一个全局数组，用来记录每个物理页被引用了多少次，建立一个全局变量 **pageref** 的数组，它的长度为有多少个物理页（128*1024*1024 / 4096 = 32768）。在kalloc.c文件中初始化这个全局变量，如何设计引用计数机制呢？按照实验目的可以拆分为以下几个步骤。

1. 每次调用fork增加一次对应物理页的引用（这一步在uvmcopy中实现）。
2. 进程退出时，会释放页表指向的所有物理页，因此在kfree中需要对对应物理页的引用数做判断，当要释放的物理页没有其他进程引用时才可以释放（pageref[index] == 1）。
3. 每次调用kalloc，需要初始化物理页的引用值（pageref[index] = 1）。

按照以上步骤，需要将物理页的地址映射到pageref的索引中，为了方便使用添加一个宏。

```c
#define KERNBASE 0x80000000L
#define PAGECOUNT (128*1024*1024 / 4096)
#define PA2INDEX(p) (((p)-KERNBASE) / 4096)
// 全局变量pageref 用来储存对应物理页的引用数
extern int pageref[];
```

#### 修改uvmcopy

```c
int
uvmcopy(pagetable_t old, pagetable_t new, uint64 sz)
{
  pte_t *pte;
  uint64 pa, i;
  uint flags;

  for(i = 0; i < sz; i += PGSIZE){
    if((pte = walk(old, i, 0)) == 0)
      panic("uvmcopy: pte should exist");
    if((*pte & PTE_V) == 0)
      panic("uvmcopy: page not present");
    pa = PTE2PA(*pte);
    // 增加该页的引用数
    pageref[PA2INDEX(pa)] += 1;
    // 重置父子进程对该页的权限，都设置为不可写。
    flags = PTE_FLAGS(*pte) & ~PTE_W;
    *pte = (*pte &~ 0x3ff) | flags;
    if (mappages(new, i, PGSIZE, (uint64)pa, flags) != 0)
    {
      goto err;
    }
  }
  return 0;

 err:
  uvmunmap(new, 0, i / PGSIZE, 1);
  return -1;
}
```

#### 
#### 修改kalloc.c

在kfree中需要特别注意，因为在内核启动初始化时，会调用一次freerange，清除所有物理内存页，加入到内存分配器中，而此时pageref 数组的所有元素都为0，但当进程释放时，最后一个要释放的进程对应的物理页的ref应该为1，所以为了保持同步应该在freerange中将pageref都置为1。

```c
void
freerange(void *pa_start, void *pa_end)
{
  char *p;
  p = (char*)PGROUNDUP((uint64)pa_start);
  for(; p + PGSIZE <= (char*)pa_end; p += PGSIZE){
    // 同kfree中保持一致。
    pageref[PA2INDEX((uint64)p)] = 1;
    kfree(p);
  }
}
```

因为xv6是支持多cpu执行的os，因此在各个代码的执行流中都有可能出现中断的情况，为了保证pageref的一致性，需要将对pageref的修改放入到临界区中，用锁来保障pageref的一致性。

```c
void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");

  r = (struct run*)pa;

  acquire(&kmem.lock);
  int ref = pageref[PA2INDEX((uint64)r)];
  if (ref == 1 )
  {
    // Fill with junk to catch dangling refs.
    memset(pa, 1, PGSIZE);
    r->next = kmem.freelist;
    kmem.freelist = r;
    pageref[PA2INDEX((uint64)r)] = 0;
  }
  else
  {
    // 每调一次kfree 减去一次引用，直到引用为1时，直接释放该物理页。
    pageref[PA2INDEX((uint64)r)] -= 1;
  }
  release(&kmem.lock);
}
```
与kfree对应在kalloc函数中也需要做类似处理，把pageref初始化。
```c
void *
kalloc(void)
{
  struct run *r;

  acquire(&kmem.lock);
  r = kmem.freelist;
  if(r){
    kmem.freelist = r->next;
    pageref[PA2INDEX((uint64)r)] = 1;
  }

  release(&kmem.lock);

  if(r)
    memset((char*)r, 5, PGSIZE); // fill with junk
  return (void*)r;
}
```


### 捕获page fault  进行写时分配


修改trap流程，在**usertrap**函数中捕获page fault，page fault 的scause是15。而在这个handler中我们需要做以下几个操作

1. 分配一个新的物理页，并拷贝va地址范围内的页的数据到新分配的页中。
2. 释放之前引用的物理页，重置pte指向新分配的页 并有可写权限PTE-W。
3. 对每个物理页的引用计数计算交给kfree函数处理，如果对应引用为0就释放该物理页。

新增函数cowhandler。
```c
int cowhandler(pagetable_t pagetable,uint64 va){
  pte_t *pte;
  uint64 pa;
  uint flags;
  uint64 down = PGROUNDDOWN(va);

  // get the readonly page address
  // 先拿到引用的物理页地址和对应的pte指针。
  if((pte = walk(pagetable, down, 0)) == 0)
    panic("cowhandler: pte should exist");
  if((*pte & PTE_V) == 0)
    panic("cowhandler: page not present");
  pa = PTE2PA(*pte);
  flags = PTE_FLAGS(*pte) | PTE_W;
  // alloc a new page and copy data
  char *mem;
  if ((mem = kalloc()) == 0)
    return 0;
  memmove(mem, (char*)pa, PGSIZE);

  //map new page to process and reset PTE-W
  *pte = PA2PTE(mem);
  *pte = (*pte &~ 0x3ff) | flags;

  //free old page
  kfree((void *)pa);

  return 1;
}
```

至此，基本已经完成了该lab 90%的工作量，完整的流程已经跑通了。


### 修改copyout函数

不过按照lab 提示还需要对copyout函数做修改，也让它符合cow的流程，首先要知道为什么需要单个把 **copyout **还要做一次处理呢，在这重新梳理一下 **copyout **流程。

```c
int
copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)
{
  uint64 n, va0, pa0;

  while(len > 0){
    ....
    // 这里在进行数据拷贝时直接覆盖了原有物理页的内容，不符合cow的处理流程，会影响到所有引用这
    // 个物理页的进程
    // 因此需要修改copyout函数，不让它直接覆盖，而是触发cow。
    memmove((void *)(pa0 + (dstva - va0)), src, n);
    ....
  }
  return 0;
}
```

可以看到，在原有copyout函数中，是通过直接覆盖物理页地址的方式来进行复制的，但是我们现在增加了cow机制，就会出现在子进程调用copyout函数时（例如read，write等系统调用），将引用的物理页内容直接进行覆盖，这种操作会影响到所有引用该页的进程，导致数据错乱，因此我们需要对copyout做处理。

处理如下。

1. 先判断该进程的pte指针有没有写权限。
2. 没有写权限的话执行一次cowhandler，然后再拿到新分配的页的地址执行复制操作。

```c
int
copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)
{
  uint64 n, va0, pa0;
  int haswrite = 0;

  while(len > 0){
    va0 = PGROUNDDOWN(dstva);
    pa0 = walkaddr(pagetable, va0);
    if(pa0 == 0)
      return -1;
    // determine if process have write access
    haswrite = PTE_FLAGS(PA2PTE(pa0)) & PTE_W;
    if(haswrite == 0){
      if(cowhandler(pagetable, va0) == 0)
        return -1;
      pa0 = walkaddr(pagetable, va0);
    }
    n = PGSIZE - (dstva - va0);
    if(n > len)
      n = len;
    memmove((void *)(pa0 + (dstva - va0)), src, n);

    len -= n;
    src += n;
    dstva = va0 + PGSIZE;
  }
  return 0;
}
```

cow机制修改完毕，所有测试通过。


## 总结

与以往lab的修改不同，这次的lab基本上一气呵成，修改完后，所有的测试用例都直接跑通了，没有出现前几次lab中那么多的error和failed情况，我发现这种边写笔记边做lab的方式，对我思考和编码有很大的帮助，能够更好的梳理流程和发现易遗落和错误的地方，以前习惯直接思考然后编码，往往容易钻死胡同和遗落很多细节，导致整体的流程被拉得很长，人也会变得沮丧和没有信心。

**写作就是最好得思考方式！！！ 加油加油。**



