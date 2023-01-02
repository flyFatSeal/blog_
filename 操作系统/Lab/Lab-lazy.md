## 前置知识

本次实验主要目的是实现内存懒分配功能，依赖page fault机制，捕获对应的trap类型，优化现有xv6 内存分配机制，提高程序运行效率。

涉及到的章节有 chapter 3 chapter 4，需要了解页表和进程的映射过程，和trap的执行机制。

## 核心目的

实现现代操作系统的通用技巧，内存懒分配，即当进程申请一个大容量的地址空间时，不马上从内存分配器中将对应内存分配给该进程，而是先增长进程的大小参数，等待程序运行时，再实时分配内存。

## 思路

当前xv6的内存分配机制是，事先分配好内存再执行进程，现按照该实验的目的，需要将该流程修改。具体为，当进程申请内存时，不马上把它申请的内存分配给该进程的页表，而是先增长该进程的大小参数（p->sz+=n），随后当该进程操作它申请的内存空间时，会产生一个cpu错误（**page fault**），此时os进入内核态，错误被usertrap函数捕捉到，在此处再实际分配对应内存给该进程，随后返回用户态继续执行代码。


## 问题

### 如何在usertrap中捕获该错误

按照上述思路，当进程操作一个未分配的内存地址空间时，会产生一个错误，将流程提升至内核态，并被usertrap函数捕获，而在原有usertrap函数中，是不会对这种情况进行判断的，因此首先需要知道如何给这种情况添加对应的判断条件（scause 是什么值表示该错误 ）。

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/scause.png#crop=0&crop=0&crop=1&crop=1&id=PfOfc&originHeight=775&originWidth=818&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

通过查询risc-v 操作手册，可以知道进程操作未分配内存地址空间的错误类型对应的scause 应该是 13（load page fault） 或者 15 （store/amo page fault） 。

```c
void
usertrap(void)
{
  int which_dev = 0;

  if((r_sstatus() & SSTATUS_SPP) != 0)

  w_stvec((uint64)kernelvec);

  struct proc *p = myproc();
  
  // save user program counter.
  p->trapframe->epc = r_sepc();
  
  if(r_scause() == 8){
    // system call
	....
  } else if((which_dev = devintr()) != 0){
    // ok
  } else if(r_scause() == 13 || r_scause() == 15){
    // 捕获到page fault 执行 lazy allocate
    ....
  }
  else {
    printf("usertrap(): unexpected scause %p pid=%d\n", r_scause(), p->pid);
    printf("            sepc=%p stval=%p\n", r_sepc(), r_stval());
    p->killed = 1;
  }
  ....
  usertrapret();
}

```

### 如何在usertrap中进行懒分配

现在已经增加了捕获懒分配的判断条件了，还需要在该判断条件内实现懒分配，首先我们参考原有sbrk系统调用中growproc的调用流程。而growproc函数中的核心调用是uvmalloc。

```c
// Allocate PTEs and physical memory to grow process from oldsz to
// newsz, which need not be page aligned.  Returns new size or 0 on error.
uint64
uvmalloc(pagetable_t pagetable, uint64 oldsz, uint64 newsz)
{
  char *mem;
  uint64 a;

  if(newsz < oldsz)
    return oldsz;

  oldsz = PGROUNDUP(oldsz);
  for(a = oldsz; a < newsz; a += PGSIZE){
    // 分配物理内存页
    mem = kalloc();
    if(mem == 0){
      uvmdealloc(pagetable, a, oldsz);
      return 0;
    }
    memset(mem, 0, PGSIZE);
    // 将物理内存页映射到进程的页表中，映射完后进程就可以正常使用对应的虚拟地址
    if(mappages(pagetable, a, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0){
      kfree(mem);
      uvmdealloc(pagetable, a, oldsz);
      return 0;
    }
  }
  return newsz;
}
```

所以需要在scasue == 13  || scause ==15 时也做对应的操作，分配物理页，然后映射到页表中，再返回到中断时的用户虚拟地址继续执行程序。

```c
// usertrap
void usertrap(){
    .....
    else if(r_scause() == 13 || r_scause() == 15){
        // page fault
        uint64 va = r_stval();
        uint64 a = PGROUNDDOWN(va);
        // alloc page 
        char *mem = kalloc();
        if(mem == 0){
          ....
        }else{
          memset(mem, 0, PGSIZE);
          if(mappages(p->pagetable, a, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0){
  			....
          }
        }
     }
    ....
}
```

根据后续的lab提示我们需要在其他地方也要调用lazy allocate 因此单独抽成一个函数。

```c
// 记得处理特殊情况！
void lazyalloc(uint64 va){
    // page fault
    struct proc *p = myproc();
    uint64 a = PGROUNDDOWN(va);
    if (a >= p->sz || a <= p->trapframe->sp){
      p->killed = 1;
      return;
    }

    // alloc page
    char *mem = kalloc();
    if (mem == 0)
    {
      p->killed = 1;
      return;
    }
    memset(mem, 0, PGSIZE);
    if(mappages(p->pagetable, a, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0){
      kfree(mem);
      uvmdealloc(p->pagetable, va, a);
      p->killed = 1;
    }
}
```

####  ERROR: panic:kfree

这种写法出现了panic：kfree 应该是在页表中标记了被分配了的pte，但是实际又没有分配对应的物理内存页，导致释放出错，先查为什么被标记了但是又没有被分配物理页。

以 **echo hi **执行为例进行流程跟踪

sbrk： p->sz : 16384 + 65536

进入 scause 15 ： 对地址在 16384-> 16384 + 4096 区间分配一个物理页并映射到页表中。

   分配的物理页： mem 0x87f59000 
   页表 pte ：  0x87f65020 = 0x87f59000

进入 scause 15 ： 对地址在 77824-> 77824 + 4096 区间分配一个物理页并映射到页表中。

  分配的物理页： mem 0x87f58000
  页表 pte ： 0x87f65098 = 0x87f58000

此刻在 proc_freepagetable执行时会报错，而报错的页表地址是 0x87f65028 ，其实原因已经清楚了，0x87f65028 处于 0x87f65020 和 0x87f65098 之间，而在执行echo hi 时 我们可以看到 该系统调用申请了 65536/4096 = 16页 的内存，而在实际执行中，它只使用了两页的内存，所以usertrap 只分配了两次，而在proc_freepagetable时，是将p->sz范围内的页表全部释放，因此它就会去释放部分未分配内存页的pte页表导致报错，所以对在p->sz范围内 未分配内存页的地址不执行释放操作即可。该处代码在**uvmunmap**函数中处理。

```c
// Remove npages of mappings starting from va. va must be
// page-aligned. The mappings must exist.
// Optionally free the physical memory.
void
uvmunmap(pagetable_t pagetable, uint64 va, uint64 npages, int do_free)
{
  uint64 a;
  pte_t *pte;

  if((va % PGSIZE) != 0)
    panic("uvmunmap: not aligned");

  for(a = va; a < va + npages*PGSIZE; a += PGSIZE){
    if((pte = walk(pagetable, a, 0)) == 0)
      panic("uvmunmap: walk");
    if((*pte & PTE_V) == 0){
     // 原有uvmunmap会将处于p->sz范围内未分配内存的地址直接panic，现在跳过这种情况即可   
     // panic("uvmunmap: not mapped");
     continue;
    }
    if(PTE_FLAGS(*pte) == PTE_V)
      panic("uvmunmap: not a leaf");
    if(do_free){
      uint64 pa = PTE2PA(*pte);
      kfree((void*)pa);
    }
    *pte = 0;
  }
}
```
修改后，执行正确。


## Lazytests and Usertests

需要通过完整的测试用例。

#### ERROR panic freewalk： leaf

1:
这个错误表示，存在调用freewalk方法时，有部分页表映射的物理页未被释放掉。而且该错误出现在freeproc(np)时。

直接运行debug

出现该错误的进程  pte 567988255 显示此pte还有指向的内存页未释放， 而这个pte 处于 0-0-4 ，这个位置的pte应该在sbrk时就被释放了才对。

```c
  // 错误解决
  // lazyalloc 
   if (a >= p->sz || a<= p->trapframe->sp){
      p->killed = 1;
      // 忘记在不符合分配情况下return 终止执行，导致不能分配页的情况仍然被分配了 
      return;
    }
```

2:
p->pid 6
p->pagetable 0x87207000
p->sz 12288

在fork时，子进程是copy了父进程的sz的 也就是原本 p->sz 1073754112 但是在调用sbrk(- n)的时候它的sz 就变成 12288了，需要查明为什么sz不一致。

```c
// 错误解决
uint64
sys_sbrk(void)
{
  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;
  addr = myproc()->sz;
  // 之前我把对sz的操作放在了 growproc操作之前，所以被提前缩小了 导致后续函数执行失败
  // error code: myproc()->sz += n;
  if(n<0){
    if (growproc(n) < 0)
      return -1;
  }
  // 对sz 字段的操作应该放在growproc之后
  myproc()->sz += n;
  return addr;
}
```

#### ERROR panic ： walk

出现了子进程的sz 大于MAXVA的情况，但是sz应该是在fork时就已经和父进程同步了才对，要先知道它在那里被修改了。

parent process
p->sz 1073754112
children process
p->sz 18446744072635822080

```c
// Grow or shrink user memory by n bytes.
// Return 0 on success, -1 on failure.
int
growproc(int n)
{
  uint sz;
  struct proc *p = myproc();

  sz = p->sz;
  if(n > 0){
    if((sz = uvmalloc(p->pagetable, sz, sz + n)) == 0) {
      return -1;
    }
  } else if(n < 0){
    sz = uvmdealloc(p->pagetable, sz, sz + n);
  }
  // growproc函数本身就会修改p->sz的值，再原本的流程中，我又在sbrk中修改了一次，导致int溢出
  p->sz = sz;
  return 0;
}
```
```c
uint64
sys_sbrk(void)
{
  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;
  addr = myproc()->sz;
  if(addr+n >= MAXVA)
    return -1;
  if (n < 0)
  {
    if (growproc(n) < 0)
      return -1;
  }else{
    // 需要和growproc互斥才行
    myproc()->sz += n;
  }
  return addr;
}
```

#### sbrkarg: write sbrk failed

这个测试用例是用来测试 对分配页面的读写，那么就是代码没有处理好 **当处于系统调用时对未分配的页面进行读写操作的情况**。

如何处理这种情况，首先在执行系统调用函数时，os处于内核态，此时应该产生一次内核级别的中断，在中断处理函数中，捕获page fault错误，然后执行内存分配，再通过sepc指针返回中断处的地址，继续执行。简单梳理一下内核级别中断的处理流程。

1. 处于内核态时，trap handler （stvec） 指向 kernelvec
2. kernelvec 会保存上下文到内核栈中，再跳转到 kerneltrap函数
3. kerneltrap函数处理对应trap
4. 返回kernelvec，从内核栈中恢复上下文，调用sret指令恢复执行流

因此我们要和usertrap处理的流程一样在kerneltrap也一样添加scause的条件判断。

```c
// kerneltrap  
if(scause == 13 || scause == 15)
    lazyalloc(r_stval());
```

同时，需要特别注意write和read系统调用，因为在write系统调用流程中，发现并不会因为读取未分配的内存页而产生trap，因为在这两个系统调用内部就已经对未分配页的pte指针的读取做了**容错处理**，我们需要浸入系统调用流程中解除这个容错。

原有流程是：**发现该地址未分配页，返回0，系统调用失败**
修改为：**发现该地址未分配页，并且地址处于p->sz 范围内，分配页**

追踪write系统调用流程

**sys_write->filewrite->writei->either_copyin->copyin->walkaddr**


```c
// Look up a virtual address, return the physical address,
// or 0 if not mapped.
// Can only be used to look up user pages.
// 如果该虚拟地址未被映射就返回0，外层会探测walkaddrss是不是返回0，如果0则系统调用失败，因此
// 需要修改这个函数
uint64
walkaddr(pagetable_t pagetable, uint64 va)
{
  pte_t *pte;
  uint64 pa;

  if(va >= MAXVA)
    return 0;

  pte = walk(pagetable, va, 0);
  if(pte == 0){
    return 0;
  }
    
  if((*pte & PTE_V) == 0){
    // 此处进行修改，在满足懒分配的情况下 直接分配页 不返回0
    if(va < myproc()->sz){
      lazyalloc(va);   
      pte = walk(pagetable, va, 0);
    }else
      return 0;
  }

  if((*pte & PTE_U) == 0){
    return 0;
  }
  pa = PTE2PA(*pte);
  return pa;
}
```

修改完毕，所有测试用例通过。


## 总结

lazy allocate 是相对比较简单的lab，然而在编写中，我依然出现了各种错误，原因仍然是没有养成错误处理的习惯，并且对一些流程的处理很马虎，这个是我一贯的坏毛病，在内核编程中，如果对细节不注重处理好的话，需要花费很多时间debug，才能发现问题出现在哪里，而且往往找到原因后，令人发笑。

**多注重，多用心**。

