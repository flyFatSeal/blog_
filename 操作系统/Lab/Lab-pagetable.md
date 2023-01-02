## 前置知识
## 
Chapter 3 Chapter4 ，主要要明白虚拟地址怎么转换物理地址，页表结构和虚拟地址如何寻址，以及系统调用得流程，用户态是如何陷入内核态，和sys_exec系统调用得具体流程。

## 核心目的

目前xv6在执行部分系统调用时，因为各个进程都有自己得页表，内核也有单独得内核页表，它们彼此之间同一虚拟地址映射得物理地址，是不一致得，因此在进程调用系统调用，陷入内核态时，会涉及到系统调用得参数传递，进程传递得参数是进程用户页表下的虚拟地址，此时系统如果直接去用这个地址寻址是找不到实际地址得，需要在系统调用时将用户进程传递的指针 由用户进程下得虚拟地址转换为实际的物理地址，这样内核就能得到正确得传递值。

```c
// user/wc
char buf[512];
// buf 此时分配的地址是处于用户页表中，内核无法直接使用
while ((n = read(fd, buf, sizeof(buf))) > 0)
// 需要转换缓冲区的虚拟地址。
```


而这个lab pagetable的核心要求就是 实现 **内核直接使用进程传递进来的虚拟地址，不进行转换**。

如同所示，进程的内核页表和用户页表在相同的虚拟地址上映射到同一个物理页地址。


![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/XV6-LAB3.png#crop=0&crop=0&crop=1&crop=1&id=X0J3j&originHeight=788&originWidth=1189&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)


## 思路

最终实现的目标是 内核直接使用进程传递的虚拟地址，不需要转换，为了达到这个目的，整个实现流程分为两个阶段。

1：**实现每个进程单独的内核页表**
2：**让进程内的用户地址能够直接映射到进程的内核页表中。**

所以从整个lab切分就可以看出，实现直接访问的思路是什么，每个进程有自己的内核页表，同时将进程内的虚拟地址也映射到进程的内核页表中，这样在每次进程陷入内核态时，就不用转换虚拟地址了，因为进程内部的用户地址的实际物理地址被分别映射了两次。


## lab 2 A kernel page table per process

### 核心：实现进程单独的内核页表

### 思路

参考内核初始化（kvminit）如何映射页表的流程，在每个进程创建时分配一个内核页表即可，也可以参考老师视频讲解中共享内核页表的方法，共享页表对性能的提升很大。

在为每个进程创建内核页表时有几点需要注意（多看lab的hit hit的提示一定有它的意义，如果不理解就是对整体架构和细节了解不到位）。

1. 进程中的内核栈需要映射到进程的内核页表中，在正常分支的代码中，各个进程的内核栈是在procinit函数初始化所有进程时就已经创建，因此在整个实验中，需要将原本procinit 函数中初始化内核栈的行为迁移到分配进程的函数中（procinit->allocproc）。

**什么是内核栈**：目前我对内核栈的认知就是内核自身是多线程的，例如scheduler函数本身就是单独运行在cpu自身的线程中，只有在内核放弃自身正在运行的线程，才会接着执行scheduler，内核栈是保存内核运行不同线程数据（寄存器）的容器如同用户进程的trapframe一样。

2. 在scheduler函数中，在被选中调度的进程在switch之前，替换当前的页表。

**为什么是 swtch之前**：这里要明白swtch是协程的概念，即swtch后 cpu的pc指针会直接被替换成p->context 中保存的ra寄存器，此时程序执行流会被直接截断到ra寄存器开始，也就是说swtch后的代码执行需要等到这个被调度的进程被内核切换为止后才执行，因此放在后面再装载新的进程内核页表，会导致后续的代码无法转换到正确的地址，程序报错。

3. 有分配就有释放，进程退出后，需要释放分配的内核页表和内核栈，注意在释放内核页表前释放内核栈。

**为什么要先释放内核栈**：释放内核页表时，不会将对应的物理页也释放掉，但是会把对应pte置为0，这样释放内核栈放在释放页表后面，就会导致拿不到对应内核栈的物理地址，程序报错。

4. 释放进程的内核页表时不能同时把物理页也回收。

**为什么不能同时把物理页也回收：**该实验的核心思路上面已经提到过，是将用户页表中相同虚拟地址也映射到进程的内核页表中，所以在释放进程时，用户页表回收中会把对应的物理页也同时回收掉，因此在回收内核页表时就不在需要重新回收一次物理页了。


![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/xv6__pagetable.png#crop=0&crop=0&crop=1&crop=1&id=Q8Vyg&originHeight=715&originWidth=722&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)


## lab 3 Simplify copyin/copyinstr

### 核心：在进程的内核页表中添加用户地址映射

### 思路

lab要求把copyin和copystr函数替换为copyin_new和copystr_new，而新函数和旧函数最大的区别就是，新函数不在调用walk函数把虚拟地址转换为物理地址后在执行复制操作，而是直接拿虚拟地址直接进行复制操作。因此，我们知道此时用户页表的虚拟地址所映射的物理地址和进程的内核页表是一致的。

为了达到，用户页表和进程的内核页表映射一致的效果，我们就需要在用户页表映射物理地址的过程中，将对应的映射同步到进程的内核页表中，而在xv6中映射的核心函数是mappages和uvmalloc。



```c
uint64
uvmalloc(pagetable_t pagetable, uint64 oldsz, uint64 newsz)
{
  char *mem;
  uint64 a;

  if(newsz < oldsz)
    return oldsz;

  oldsz = PGROUNDUP(oldsz);
  for(a = oldsz; a < newsz; a += PGSIZE){
    mem = kalloc();
    // 这里分配的物理页mem 就是实际用户地址使用的物理页，
    // 剩下的步骤就是建立 va->mem 的三级页表映射过程
    if(mem == 0){
      uvmdealloc(pagetable, a, oldsz);
      return 0;
    }
    memset(mem, 0, PGSIZE);
    if(mappages(pagetable, a, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0){
      kfree(mem);
      uvmdealloc(pagetable, a, oldsz);
      return 0;
    }
  }
  return newsz;
}	
```
```c
int
mappages(pagetable_t pagetable, uint64 va, uint64 size, uint64 pa, int perm)
{
  uint64 a, last;
  pte_t *pte;

  a = PGROUNDDOWN(va);
  last = PGROUNDDOWN(va + size - 1);
  for(;;){
    // 拿到用户页表对应该va的最后一层pte值，在获取过程中，如果未分配会自动分配对应的页
    if((pte = walk(pagetable, a, 1)) == 0)
      return -1;
    if(*pte & PTE_V)
      panic("remap");
    // 将uvmalloc 分配的物理页地址赋值给pte，至此映射关系建立完毕
    *pte = PA2PTE(pa) | perm | PTE_V;
    if(a == last)
      break;
    // 只有在初始化kernel的时候才存在连续分配的情况，这时物理地址的范围为0~0x80000000 
    // 不需要依赖内存分配器，所以直接加值就可以了。 如果不明白请细看 book chapter 3.2
    a += PGSIZE;
    pa += PGSIZE;
  }
  return 0;
}
```

###  问题

1. exec系统调用会将程序初始化并加载代码段到用户页表中，此时，按照进程内的内核页表与用户页表同步的解题思路，应该同时将相应的代码段也映射到内核页表中的同一地址上，这样才能不用转换地址 通过copy_new函数直接拿到对应的地址，那么问题来了 exec中 是通过分配一个空白的用户页表，将代码段加载在空白页表中，最后释放掉原进程自身的用户页表，替换为这个新页表，而此时我们程序是运行在上一个lab的基础上的，也就是说此时进程的内核页表是作为正在的运行的内核页表而存在，不能像对进程的用户进程页表处理的方式一样，直接分配一个新的，然后替换掉就行了，因为内核正在依赖此时进程的内核页表，不能被释放，但是我们需要释放进程内核页表的部分地址，这样才能在程序初始化代码片段时，不出现重复映射。根据simply lab提示，usermapping是映射在0～PLIC 地址区间中的，~~那我们是不是在exec中，对进程的内核页表处理，只需要释放该虚拟地址区间的二级和三级页表即可~~（**这种方式不行，在execout中会有详细解释**）。

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/649D6352-BA84-40C5-ADE9-A86936C874C5.png#crop=0&crop=0&crop=1&crop=1&id=IMMB8&originHeight=480&originWidth=848&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

 

#### USERTESTS:ERROR 


##### reparent2  twochildren: out of memory

在fork时 **uvmcopy** 对 p->kpagetable 应该存在内存碎片没有被回收掉。

```c
// 原本 这是适用于p->pagetable 的内存复制办法，他会分配一个新的物理页并将原本父进程对应物理页
// 的内容，复制到整个新的物理页中，最后映射到页表中，但是！对于p->kpagetable来说，释放掉进程时
// p->kpagetable 是不会去释放物理页的，所以 这里遗失了对uvmcopy时分配给p->kpagetable物理页
// 的回收，导致内存越来越少，以至于内存为空。因此需要为复制父进程的p->kpagetable写一个新的函数
// 不能使用p->pagetable的页表复制函数。
if((mem = kalloc()) == 0){
      printf("err \n");
      goto err;
    }
 memmove(mem, (char*)pa, PGSIZE);
```
##### sbrkmuck panic remap

进程的内核页表在执行sbrk 缩小时没有执行好正常的操作，导致释放失败，再次分配时 报重复映射错误。

执行sbrk(-4096)时

```c
int
growproc(int n)
{
  uint sz;
  struct proc *p = myproc();

  sz = p->sz;
  if(n > 0){
    if((sz = uvmalloc(p->pagetable,p->kpagetable, sz, sz + n)) == 0) {
      return -1;
    }
  } else if(n < 0){
    // 此处出错，因为如果先执行p->pagetable的uvmdealloc 会改变sz的值，sz会从原本的值
    // 变成缩小后的值,因此需要先释放p->kpagetable的内存映射，然后再释放用户页表
    sz = uvmdealloc(p->pagetable, sz, sz + n,0);
    uvmdealloc(p->kpagetable, sz, sz + n,1);
  }
  p->sz = sz;
  return 0;
}
```

##### fourfiles: sharedfd:


~~fork时子进程无法向文件描述符指向的文件执行写入。这里不太像是文件描述符在fork出现了问题，反而像是子进程在调用write时 没有正确的转换用户地址。~~

出现子进程错误，在fork调用执行时，需要同时将父子进程的用户页表和内核页表同步。

```c
  // Copy user memory from parent to child.
  if(uvmcopy(p->pagetable, np->pagetable, p->sz) < 0){
    freeproc(np);
    release(&np->lock);
    return -1;
  }
  // Copy kernel usermapping 
  // 此处错误，不能按照用户页表复制的方式复制内核页表，因为用户页表在复制时，会给子进程分配新的
  // 物理页，按照simplyify lab的实验要求，进程的内核页表应该是和用户页表同步的，因此这里应该
  // 为 kvmcopy(np->pagetable, np->kpagetable, p->sz)
  if(kvmcopy(p->pagetable, np->kpagetable, p->sz) < 0){
    freeproc(np);
    release(&np->lock);
    return -1;
  }
```


##### FAILED -- lost some free pages 26006 (out of 32431)


全部测试通过，但是出现在测试结束后部分占用内存未释放现象，存在内存泄露的风险，需要排查那里出现内存不释放。首先缩小问题范围，应该不是部分测试导致内存不释放，这个现象是普遍存在的，也就是运行进程后，存在内存碎片，按照代码增进方式来看，大概问题出现在内核页表释放过程中，首要查看代码，用二分法缩进问题范围。

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/E7ABDA68-E083-4C36-BF70-06434F09CC61.png#crop=0&crop=0&crop=1&crop=1&id=UbF8G&originHeight=732&originWidth=716&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)


这里是usertest运行时，对每个test检查内存使用前后状况，发现每个test都会比上一次少两页的内存，这个两页内存，多半就是内核页表回收时，二级页表遗失了。按照内核回收流程检查代码，感觉没什么问题，这样的话从最小示例开始，一步一步查看内存分配和释放。

p->pid:3

p->pagetable: init  ~~0x87fb5000~~  ~~0x87fb4000~~ ~~0x87fb3000~~  uvmcpoy ~~0x87f8b000~~ ~~0x87f8a000~~ ~~0x87f89000~~  ~~0x87f88000~~  ~~0x87f87000~~ ~~0x87f86000~~ ~~0x87f84000~~ ~~0x87f83000~~ ~~0x87f82000~~ ~~0x87f81000~~ ~~0x87f80000~~ ~~0x87f7f000~~ ~~0x87f7e000~~ ~~0x87f7d000~~ ~~0x87f7c000~~ ~~0x87f7b000~~ ~~0x87f7a000~~ ~~0x87f79000~~ ~~0x87f78000~~ ~~0x87f77000~~ ~~0x87f76000~~ ~~0x87f75000~~ ~~0x87f74000~~ (该页是进程的栈页-kfree(argv[i]))

p->kpagetable: 0x87f9b000(是初始化分配的第一级页表) ~~0x87f9a000~~（映射UARTO ） ~~0x87f98000~~ ~~0x87f99000~~ ~~0x87f9c000~~  kvmcopy ~~0x87f85000~~  

p->kstack: ~~0x87f8c000~~

**是我忘记释放p->kpagetable 第一级页表了。。。。。。我是傻逼**

##### bigargtest kerneltrap

bigargtest会通过将参数argv 的数据填充超过一页，从而溢出进程的执行栈，触发保护页机制，进而释放和停止exec系统调用，问题出在停止exec系统调用后，接着使用该进程执行其他系统调用，读取进程内核页表中的某个内存片段时出错，一般来讲有两个原因，一个是没有释放干净导致该进程的内核页表存在指向已被释放物理页的pte指针，二个是出错的地址范围该进程的内核页表没有权限访问（PTE_U）。既然大致归纳出来了这两个原因，那就按照这个思路进行排查，首先确定出错的内存地址是否指向了已被回收的物理页。

```c
// Copy a null-terminated string from user to kernel.
// Copy bytes to dst from virtual address srcva in a given page table,
// until a '\0', or max.
// Return 0 on success, -1 on error.
int
copyinstr_new(pagetable_t pagetable, char *dst, uint64 srcva, uint64 max)
{
  struct proc *p = myproc();
  char *s = (char *) srcva;
  
  stats.ncopyinstr++;   // XXX lock
  for(int i = 0; i < max && srcva + i < p->sz; i++){
    // 此时i== 0时就出错了 kerneltarp 找到此时kpagetable 地址为零指向的物理页是那个并且
    // 确认是何时分配的
    dst[i] = s[i];
    if(s[i] == '\0')
      return 0;
  }
  return -1;
}
```
找到原因了，在原本exec程序实现中，我会首先释放当前进程内核页表中的用户空间片段，来保证在程序初始化时，该页表不会出现重复映射情况（因为userinit时，进程内核代码也会复制一份用户页表的内存映射来达到同步）然而在exec系统调用出错时，原本应该存在于当前进程内核页表中的内存映射，在exec中被释放掉了，所以下一次调用其他系统调用时，会出现kerneltrap，**因为程序试图去访问一个已被释放的物理页**。为了保证当前进程在exec调用出错时也能接着调用其他系统调用，对进程内核页表的处理，应该和exec中对用户页表的处理一致，使用一个替代页来执行（我想起来我为什么不使用和用户页表一致的操作流程了，因为在exec中执行完成后需要释放旧的页表，而此时cpu的stap寄存器的值是当前进程内核页表的地址，**无法做到自己在程序运行中释放自己**。）
```c
int
exec(char *path, char **argv)
{
  char *s, *last;
  int i, off;
  uint64 argc, sz = 0, sp, ustack[MAXARG+1], stackbase;
  struct elfhdr elf;
  struct inode *ip;
  struct proghdr ph;
  pagetable_t pagetable = 0, oldpagetable;
  struct proc *p = myproc();
  // 关键函数，这里把该进程内核页表中的用户地址映射全部释放掉了
  freekernelusermap(p->kpagetable,2);
  ......

  // Load program into memory.
  for(i=0, off=elf.phoff; i<elf.phnum; i++, off+=sizeof(ph)){
    ....
    if((sz1 = uvmalloc(pagetable,p->kpagetable, sz, ph.vaddr + ph.memsz)) == 0)
      goto bad;
 	....
  }
  ....
  if((sz1 = uvmalloc(pagetable,p->kpagetable, sz, sz + 2*PGSIZE)) == 0)
    goto bad;
  sz = sz1;
  uvmclear(pagetable, sz-2*PGSIZE);
  kvmclear(p->kpagetable, sz-2*PGSIZE);
  sp = sz;
  stackbase = sp - PGSIZE;

  // Push argument strings, prepare rest of stack in ustack.
  for(argc = 0; argv[argc]; argc++) {
    if(argc >= MAXARG)
      goto bad;
    sp -= strlen(argv[argc]) + 1;
    sp -= sp % 16; // riscv sp must be 16-byte aligned
    if(sp < stackbase)
      goto bad;
    if(copyout(pagetable, sp, argv[argc], strlen(argv[argc]) + 1) < 0)
      // 是在此处goto bad
      goto bad;
    ustack[argc] = sp;
  }
  ustack[argc] = 0;

  // push the array of argv[] pointers.
  sp -= (argc+1) * sizeof(uint64);
  sp -= sp % 16;
  if(sp < stackbase)
    goto bad;
  if(copyout(pagetable, sp, (char *)ustack, (argc+1)*sizeof(uint64)) < 0)
    goto bad;

  ....
  proc_freepagetable(oldpagetable, oldsz);            
  ....
  return argc; // this ends up in a0, the first argument to main(argc, argv)

 bad:
  if(pagetable)
    proc_freepagetable(pagetable, sz);
  freekernelusermap(p->kpagetable,2);
  if(ip){
    iunlockput(ip);
    end_op();
  }
  return -1;
}

```
           
因此，需要将原本exec函数的流程做更改，对当前进程的内核页表操作应该和对用户页表的操作流程一样，先分配一个替换页，然后在和用户页表一样初始化并填入对应的数据，最后替换掉原有的内核页表，并释放掉被替换掉的内核页表，不过需要注意的是，因为cpu运行在当前进程中，使用的是当前内核页表的地址作为stap寄存器的值，因此需要调用w_stap()将新的内核页表加载进去。


##### execout ukvmmap

将exec函数修改后，现在execout测试出错，报ukvmmap。execout测试是用来测试在内存使用完毕时，通过释放部分内存页来检查整个**exec函数执行流程对内存极限情况下的错误处理有没有到位**。此时出现ukvmmap 根据调用堆栈来看  是**proc_kpagetable **分配内存时，内存使用完毕，无法再分配一个新的内存导致。这里的处理有问题，应该仿照**proc_pagetable **的执行流程对内存分配完的极端情况 应该释放占有内存并返回0 而不是直接panic。

```c
// Create a user page table for a given process,
// with no user memory, but with trampoline pages.
pagetable_t
proc_pagetable(struct proc *p)
{
  pagetable_t pagetable;

  // An empty page table.
  pagetable = uvmcreate();
  if(pagetable == 0)
    return 0;

  // map the trampoline code (for system call return)
  // at the highest user virtual address.
  // only the supervisor uses it, on the way
  // to/from user space, so not PTE_U.
  if(mappages(pagetable, TRAMPOLINE, PGSIZE,
              (uint64)trampoline, PTE_R | PTE_X) < 0){
    // 对无内存分配情况下的处理
    uvmfree(pagetable, 0);
    return 0;
  }
  ....

  return pagetable;
}
```

```c
/*
 * create a direct-map page table for the user kernel pagetable.
 */
pagetable_t
proc_kpagetable()
{
   pagetable_t kpagetable;
  // An empty page table.
  kpagetable = uvmcreate();
  if(kpagetable == 0)
    return 0;

  // uart registers
  // 此处没有对无内存分配的情况 做处理，导致execout测试不通过 当无内存分配时
  // 应当释放当前占用的内存，并返回0给上层调用函数。
  ukvmmap(kpagetable,UART0, UART0, PGSIZE, PTE_R | PTE_W);

  // virtio mmio disk interface
  ukvmmap(kpagetable,VIRTIO0, VIRTIO0, PGSIZE, PTE_R | PTE_W);

  // PLIC
  ukvmmap(kpagetable,PLIC, PLIC, 0x400000, PTE_R | PTE_W);

  for (int i = 1; i < 512;i++){
    kpagetable[i] = kernel_pagetable[i];
  }

  return kpagetable;
}
```
绝了，调整后 又有十个物理页没有被回收，现在接着查那里忘记回收内存了，基本确认了 是**proc_kpagetable**在极端情况下没有回收已分配的第一级页表。emm 再回收了**proc_kpagetable后还是仍然有6页未被回收。 emm proc_kpagetable 内部的映射也需要回收！！！！**

**修改后all pass了**

## 总结

在我自己得代码跑通后，参考了其他人得答案，都比我简洁得多，但是我觉得我这个版本的答案对整体流程的依赖性更强，因此更清楚了xv6 的运行机制，就先留着吧。不过发现我在思考和解题过程中还是有很多问题

1. 编码的坏习惯，不做极端情况处理，在内核底层编程中，这点反而是很重要的 因为这个习惯在execout和bigargtest中都无法通过测试。
2. 思维方式过于过程化，没有抽象好函数之间的关系。
3. 对xv6 部分执行流程过于想当然，没有实际明白内部的运行关系和机制。
