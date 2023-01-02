
## 前置知识

需要了解实际mmap 系统调用的使用方式和函数原型，详细参考 linux mmap 。同时此实验部分机制类似之前的lazy 和cow 因此最好在完成了所有和页表相关的lab，再来做mmap，有相应处理页表和映射的经验后才不会感到无从下手。

## mmap

简单来说mmap 是一种内存映射文件的方法，即将一个文件或者其它对象映射到进程的地址空间，实现文件磁盘地址和进程虚拟地址空间中一段虚拟地址的一一对映关系。实现这样的映射关系后，进程就可以采用指针的方式读写操作这一段内存，而系统会自动回写脏页面到对应的文件磁盘上，即完成了对文件的操作而不必再调用 read、write 等系统调用函数。相反，内核空间对这段区域的修改也直接反映用户空间，从而可以实现不同进程间的文件共享。


### mmap 内存映射原理

这块参考文档中的文章写得很好，这里写得是简化步骤：

1. 调用用户空间 mmap，进程启动映射过程，在进程地址空间中找到一段空闲的满足要求的连续虚拟地址，并在虚拟地址空间中为映射创建虚拟映射区域（上图中左侧文件的存储映射部分）；
2. 调用内核空间的系统调用函数 mmap（不同于用户空间函数，开发者调用的是用户控件的 mmap），通过文件描述符合虚拟文件系统定位到文件磁盘物理地址，建立文件物理地址和进程虚拟地址的一一映射关系；
3. 完成映射后，进程发起对这片映射空间的访问，查询页表时会发现这一段地址不在物理页面上（因为只建立了地址映射），从而引发缺页异常，内核会将文件内容拷贝到到物理内存（主存）中，之后进程即可对这片主存进行读或者写的操作，如果写操作改变了其内容，一定时间后系统会自动回写脏页面到对应磁盘地址，也即完成了写入到文件的过程，这里写入时并不会立刻刷新到磁盘而是有延时，可以 msync 强制同步。

所以 mmap 的特点就是在操作文件时可以像操作内存那样，并且 mmap 写入文件时，不会像写入内存那样在进程退出时造成丢失，mmap 的回写时机：

- 内存不足
- 进程退出
- 调用 msync 或 munmap
- 不设置 MAP_NOSYNC 情况下 30s~50s（仅限 FreeBSD）

所以常常用来做日志相关的事情。
### 与常规文件操作区别

常规文件的主要操作步骤：

1. 进程发起文件请求，定位到文件磁盘地址，将数据从磁盘拷贝到内核空间的页缓存；
2. 内核空间不能被用户进程直接寻址，所以将页缓存中的数据页再次拷贝到内存对应的用户空间中；
3. 写文件类似，先将写入的数据拷贝至内核空间对应的主存，然后再写回磁盘；
4. 常规文件读写过程需要通过磁盘 - 页缓存 - 用户主存 两次数据拷贝。

mmap 文件的主要操作步骤：

1. 创建新的虚拟内存区域；
2. 建立文件磁盘地址和虚拟内存区域映射；
3. 访问数据时通过缺页异常，将磁盘中的数据传入内存的用户空间中；
4. mmap 读过程相比较常规文件读写，实现了用户空间和内核空间的数据直接交互，省去了页缓存步骤，从而只需要一次数据拷贝，并且读写时是对内存进行读写而省掉了常规文件的 I/O，效率更高。


## mmap 实现需求

不同于完整的mmap函数，在mmap实验中，只需要我们实现一部分mmap的功能即可，而至于是那一部分，我们通过查看实验提示和mmap单元测试可知，需要我们实现的主要特性有：

```c
void *mmap(void *addr, size_t length, int prot, int flags,int fd, off_t offset);
```

1. 实现mmap基本功能，参考linux手册的函数原型。
2. 不需要关注addr参数，可以假设它一直为0，映射的地址完全由内核决定。
3. 不需要关注offset参数，假设文件始终是全部映射。
4. 对于flags参数，只实现 MAP_SHARED 和 MAP_PRIVATE  两种权限模式。
5. 对于prot参数，只实现 **PROT_READ** 和 **PROT_WRITE** 两种模式
6. 实现懒加载，在usertrap中捕获对应得page fault，提高大文件得映射速度。

因此，我们只是实现一个mmap的子集，按照实验提示，一步一步实现mmap函数。



### 思路


首先，mmap的核心功能是将文件映射到内存中，并且需要跟踪部分信息来维护读写操作，因此必须要在内核中维护一段结构用来保存信息，由于xv6内核中没有malloc和free方法，所以使用一个固定数量的结构体数组用来存放mmap信息。

```c
struct mmap {
	uint64 address; // 记录返回映射到进程的虚拟地址
    int pid; // 进程编号
    uint64 size; // mmap函数调用的size参数
    int fd; // 文件描述符，需要在mmap调用中增加对应file 的refcnt避免被释放
    struct file *file;
    int prot; // 映射区域读写权限
    int flags;// 映射内容 共享还是私有
    int npages; // 实际使用了几个页面 -- 要后续释放的时候用
};

extern struct mmap mmapslots[NMMAP];
```

在看mmap的功能需求：将指定文件的内容映射到进程的虚拟地址中，并满足后续对该地址的读写操作，在指定MAP_SHARED的权限时，还需要将写入的内容同步到映射文件中。

拆解完成该要求在xv6中需要执行的步骤：

1. 首先是将指定文件内容映射到内核指定的进程虚拟地址中
2. 在usertrap中捕获page fault，将文件内容按需读入到分配的进程虚拟地址中
3. 对分配了MAP_SHARED的mmap调用，对映射内存区的修改需要同步到文件中


#### 建立文件和进程虚拟地址的映射关系

在实验中提到，可以假设addr参数为0，文件要映射到的虚拟地址完全由内核掌控，那么我们可以将映射地址从高到低排列，从最高的可使用的虚拟地址（**MAXVA-trampoline-trapframe**），依次递减，而回收的时候（调用munmap）以此递增，因此，在mmap系统调用中，首先找到空闲的mmap插槽，然后拿到上一个占用的地址范围，作为起点在加上这一次调用的length参数，将这个范围作为当前mmap调用的映射区。

在mmap映射中需要注意以下几种情况：

1. 权限问题判断，要注意映射文件本身的读写权限和mmap调用时的读写权限之间的相互组合。
2. 发现插槽后要增加映射文件的引用数，方便在文件描述符被全部释放后，依旧持有文件的写入能力。
3. 映射的大小和实际使用大小之间可能出现不匹配，例如mmap 映射了4页 但只使用了两页，如果只按照大小参数来作为后续munmap调用释放的参数，会出现错误。
4. 解法是自顶向下映射，所以返回的地址还是要是映射范围内的低位起点。


```c
uint64
sys_mmap(void)
{
  int fd, length, prot, flags;
  if(argint(1, &length) < 0 || argint(2, &prot) < 0 || argint(3, &flags) < 0 || argint(4, &fd) < 0){
    return -1;
  }
  length = PGROUNDUP(length);
  // get free mmap struct
  struct mmap *cur;
  int check = -1;
  int pid = myproc()->pid;
  uint64 lastva = MAXVA - (PGSIZE * 2);
  // 减去同一进程的所有已存在的mmap区域 找到合适的映射范围
  for (int i = 0; i < NMMAP; i++)
  {
    cur = &mmapslots[i];
    if (pid == cur->pid && lastva >= cur->address)
    {
      lastva = cur->address - cur->size;
    }
    if(cur->size == 0 && check == -1 ){
      check = i;
    }
  }
  if(check > -1){
    // add file refcnt                                                                                                                                                                                                                                                            
    struct file *file = myproc()->ofile[fd];
    if(file->readable == 0 && (prot & PROT_READ) )
      return -1;
    if((file->writable == 0) && ((prot & PROT_WRITE) && (flags & MAP_SHARED)))
      return -1;
    file->ref += 1;
    // free slot
    mmapslots[check].pid = pid;
    mmapslots[check].fd = fd;
    mmapslots[check].file = file;
    mmapslots[check].size = length;
    mmapslots[check].address = lastva;
    mmapslots[check].flags = flags;
    mmapslots[check].prot = prot;

    return lastva - length;
  }

  return -1;
}
```
#### 
#### usertrap 捕获page fault

在完成文件和进程虚拟内存的映射关系后，此时将映射好的虚拟地址返回给用户空间，接着用户空间在执行后续的读写操作时，由于该映射的虚拟地址未分配物理内存页，会产生一个page fault 被usertrap 函数捕获到，当捕获到 page fault时 我们检查此时的 进程号（pid）和 虚拟地址（sva），通过这个两个参数找到对应的mmap插槽，然后根据在mmap系统调用时存储的信息，在分配和读取映射文件的内容。

这里也有几个需要注意的点：

1. 此时是将所有的关于页错误的page fault都进行了捕获，因此需要特别注意区分是不是mmap本身映射区带来的page fault，有可能是违法的内存读写，如果是违法读写操作应该要杀死进程。
2. 使用buffer缓冲区来作为中间变量传递内容，需要注意buffer缓冲区的大小，如果过大会挤压执行栈导致程序出错。
3. 在mmap时 有可能出现映射范围大于实际使用的情况，但是后续释放映射区时需要实际使用范围作为参数，因此在usertrap中需要记录，映射区实际使用大小是多少（cur->npages）。

```c
 else if(r_scause() == 13 || r_scause() == 15){
    uint64 va = r_stval();
    struct proc *p = myproc();
    uint64 a = PGROUNDDOWN(va) ;
    char *mem = 0;
    // get mmap file description
    struct mmap *cur;
    int pid = myproc()->pid;
    char buffer[BSIZE];
    uint64 off ;
    for (cur = mmapslots; cur < mmapslots + NMMAP; cur++)
    {
      uint64 buttom = cur->address - cur->size;
      // find the mmap
      if(cur->pid == pid && (va < cur->address && va >= buttom)){
        // alloc page
        if((mem = kalloc()) == 0){
          p->killed = 1;
          break;
        }
        memset(mem, 0, PGSIZE);
        // read content from map file
        cur->npages += 1;
        off = a - buttom;
        for (int i = 0; i < PGSIZE; i += BSIZE)
        {
          memset(buffer, 0, BSIZE);
          if(readi(cur->file->ip, 0, (uint64)&buffer, off + i, BSIZE) < 0){
            p->killed = 1;
          }
          memmove(mem + i, buffer, BSIZE);
        }
        break;
      }
    }      
    if(mem != 0){
      if(mappages(p->pagetable, a, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0){
        kfree(mem);
        uvmdealloc(p->pagetable, va, a);
        p->killed = 1;
      } 
    }else{
      p->killed = 1;
    }
  }
```
                                                     

#### munmap系统调用

munmap函数负责将给定地址和范围区域的mmap映射区释放掉，这里需要注意的地方有：

1. 对于MAP_SHARED权限要执行回写操作，因此需要判断一次权限。
2. munmap要实际回收被分配的内存页的，因此要调用uvmunmap将映射在该范围的物理页释放。
3. 存在多次释放一个mmap映射区的情况，因此要在多次回收的映射区全部释放完后才对应减去被映射文件的引用数。
4. munmap函数在 exit 和 fork 中都要有调用，最好抽象成一个函数。

```c
int 
munmap(uint64 addr,uint64 length){
  struct mmap *cur;
  struct proc *p = myproc();
  int pid = p->pid;
  for (cur = mmapslots; cur < mmapslots+NMMAP; cur++)
  {
    if(cur->address - cur->size == addr && pid == cur->pid){
      uint64 sz = cur->size - length;
      if (sz < 0)
        return -1;
      cur->size = sz;
      break;
    }
  }
  if(cur->npages > 0){
    if((cur->flags & MAP_SHARED) && (cur->prot & PROT_WRITE) ){
    // write back to maped file 
    // sometime the map region wouldn`t alloc page the npages would be zero
      if(filewrite(cur->file, addr, length) != length){
        return -1;
      }
    }
    //free page
    uvmunmap(p->pagetable, addr, length / PGSIZE, 1);
    cur->npages -= length / PGSIZE;
  }
  if(cur->size == 0)
    cur->file->ref -= 1;

  return 0;
}
```

#### fork时需要将父进程的映射区复制到子进程中

```c
  // copy mmap to mmap struct
  struct mmap *cur,*npcur;
  for (cur = mmapslots; cur < mmapslots + NMMAP; cur++){
    if(cur->pid == p->pid && cur->size > 0){
      int findcopyslot = 0;
      for (npcur = mmapslots; npcur < mmapslots + NMMAP; npcur++)
      {
        if (npcur->size == 0 && findcopyslot == 0)
        {
          npcur->address = cur->address;
          npcur->fd = cur->fd;
          npcur->file = cur->file;
          npcur->flags = cur->flags;
          npcur->npages = 0;
          npcur->pid = np->pid;
          npcur->prot = cur->prot;
          npcur->size = cur->size;
          // add file ref
          npcur->file->ref += 1;
          findcopyslot = 1;
        }
      }
    }
  }
```

这里偷了一个懒，在复制父进程的映射区时没有把映射区内父进程的实际内容也copy到子进程中。
## 总结

mmap 实验是对前面几个关于内核的实验（lazy，cow，pagetable）的一次综合性考察，该调用流程涉及到 trap 捕获，页表映射，物理页分配回收，父子进程调用，文件读写等较为复杂的场景，如果在做该实验时感到吃力或者某些流程被卡住，可能需要回头多读几遍 chapter 3 4 8 等章节的内容。

同时，尚有疑惑的地方，该实验环境下的usertests 执行速度极慢  在未提交完成代码的原始commit下 一次完整的usertests 需要耗时 10分种左右（我是将xv6 整体运行在一个2核4g的轻量级服务器上），如果加上完整的实现代码是13-16分种，相对于其他实验环境下的usertests 慢了整整一倍还多，这点可能需要我后续有时间时排查一下是那些改动影响了代码性能。
