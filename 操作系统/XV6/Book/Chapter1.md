

目前主要精力在xv6课程上，也就是mit s6.081 ，现在是11月16号 ，看能否在三个月内 系统化得学习完，并完成所有lab，文章得主要思路不确定，主线是按照lab和xv6book 进行，目的只有一个搞懂理念和代码，因此目前大概形式是 看一遍书和视频， 观看代码 ，做lab  发现问题 ，写出问题 和解决思路，尽可能详细其中得细节。

这章主要是概念性得描述一下xv6得整体结构，从高层概念用户态和内核态开始，主要讲解了进程概念和I/O文件描述符，以及管道概念和运用细节。


## 问题一：I/O 重定向得具体细节

首先要清楚文件描述符是什么，文件描述符是一个整数，通过文件描述符，程序可以调用write systemcall 向任何形式的文件写入数据，不管写入得对象是一个文件还是管道，亦或是设备，也就是说文件描述符把要写入得东西抽象了出来，因为有文件描述符，执行写入得程序就不再需要关注写入对象是什么，它只需要知道文件描述符即可，这也是I/O 重定向得基础， 将写入程序和写入对象互相剥离，不在具有逻辑上得关系。

按照unix6 规范 所有的文件操作 都有标准输入（0） 标准输出（1）错误输出（2） 这三个整数就分别代表了程序执行时操作的文件描述符。

```c
void
cat(int fd)
{
  int n;

  while((n = read(fd, buf, sizeof(buf))) > 0) {
    if (write(1, buf, n) != n) {
      fprintf(2, "cat: write error\n");
      exit(1);
    }
  }
  if(n < 0){
    fprintf(2, "cat: read error\n");
    exit(1);
  }
}

int
main(int argc, char *argv[])
{
  int fd, i;

  if(argc <= 1){
    cat(0);
    exit(0);
  }

  for(i = 1; i < argc; i++){
    if((fd = open(argv[i], 0)) < 0){
      fprintf(2, "cat: cannot open %s\n", argv[i]);
      exit(1);
    }
    cat(fd);
    close(fd);
  }
  exit(0);
}

```
这是xv6 cat 函数的实现，可以看到 它是直接使用文件描述符1执行写入操作，输入读取的是文件描述符0，输入错误信息到文件描述符2中，因此只要在进程运行cat程序之前，将文件描述符指向的对象改变，就可以透明的改变输入输出对象，进而实现I/O重定向。

但是如果完全清楚为何能从文件描述符中读取数据，以及为什么能改变文件描述符得指向对象，就需要明白读取过程中发生了什么，程序是如何把抽象得整数描述符转换为实际得地址。

### XV6的文件系统

对于文件系统的具体描述位于book中的第九章，这里首先知道它的结构，这样就能明白文件描述符和重定向是如何操作的。

```c
// Per-process state
struct proc {
  .....
  struct file *ofile[NOFILE];  // Open files  NOFILE == 15
  .....
};
```
这是进程的结构体，这里只列出了它的file字段，可以清楚的看到 这里将进程运行中打开的文件地址存储在这个数组中，因此文件描述符其实就只是这个数组的索引而已，而实际操作的对象是这个索引对应的文件，所以我们只要替换掉索引对应的文件对象，就完成了重定向，下面是file的结构体声明，其中ip 字段就是实际操作文件的地址。

```c
struct file {
  enum { FD_NONE, FD_PIPE, FD_INODE, FD_DEVICE } type;
  int ref; // reference count
  char readable;
  char writable;
  struct pipe *pipe; // FD_PIPE
  struct inode *ip;  // FD_INODE and FD_DEVICE
  uint off;          // FD_INODE
  short major;       // FD_DEVICE
};
```
既然都看到这一步，不如在深入一点，现在清楚了文件描述符是进程 ofile的索引，那么索引对应的元素是在何时被填入到这个数组中的呢，这又要从 open 这个system call 开始说起了。

#### sys_open 系统调用

从上面cat 函数的流程，可以得知文件描述符是从open函数调用返回的，而open函数调用 实际就是 sys_open 系统调用。我们首先要清楚一些xv6文件系统设计的思想。

xv6是将进程中打开的文件放入到全局的ftable 表中，这里可以从sys_open 系统调用中看出（proc.h:287）

```c
struct {
  struct spinlock lock;
  struct file file[NFILE]; // NFILE == 100
} ftable;
```
而每个进程使用ofile字段储存进程打开的文件，因此文件描述符的范围是0-15。open函数每次调用都会创建一个新的文件并放入全局ftable中，随后放入到进程的ofile数组中，并且返回文件描述符（sysfile.c:325）。此时，我们就明白了，进程中的文件描述符是在open函数调用时分配。

#### fork 系统调用

这里是文件重定向的最后一层神秘面纱了，fork的解释放在第二章和第三章讲解，这里首先关注 第287行代码（proc.c）

```c
  // increment reference counts on open file descriptors.
  for(i = 0; i < NOFILE; i++)
    if(p->ofile[i])
      np->ofile[i] = filedup(p->ofile[i]);
```
所以在父进程调用fork后，被创建出来的子进程其实是和父进程共享同一份ofile 数组的，也就是说它们的文件描述符指向的对象一致，这里甚至包括了文件写入时的偏移量也是共享的。filedup会将父进程所有ofile得元素得ref+1，表示引用数增加。

```c
if(fork() == 0) {
  write(1, "hello ", 6);
  exit(0);
} else {
  wait(0);
  write(1, "world\n", 6);
}
```
这里最终写入得是 hello world 而不会被覆盖。

#### sys_close 系统调用

先简单描述一下close函数得作用，为下面讲解例子做铺垫。close 函数 用来关闭文件描述符。

```c
uint64
sys_close(void)
{
  int fd;
  struct file *f;

  if(argfd(0, &fd, &f) < 0)
    return -1;
  myproc()->ofile[fd] = 0;
  fileclose(f);
  return 0;
}
```
它首先会将本进程中对应文件描述符得file 置为0，同时调用fileclose ，如果这次close 是最后一个引用 也就是调用close时  该f->ref == 1，将该f 从全局得ftable中清理掉。所以 当父进程fork出子进程 而子进程关闭了 一些文件描述符，因为父进程还在引用被关闭得文件描述符，这些文件描述符指向得文件就不会被释放。

#### 文件重定向 示例

xv6 book中 使用 cat < input.txt 做文件重定向得示例，以下是cat < input.txt 时 执行得代码

```c
char *argv[2];
argv[0] = "cat";
argv[1] = 0;
if(fork() == 0) {
  close(0); // 关闭之前的标准输入文件描述符
  open("input.txt", O_RDONLY);
  exec("cat", argv);
}
```
这里很清楚得看到，在子进程中，首先把文件描述符0关闭，然后使用open打开input.txt ， 在上面open解释中，open会创建一个新得文件并把它插入到进程得ofile 和ftable中，因为close 函数调用会把进程ofile[0] == 0，
所以open调用创建得这个新得指向input.txt 得文件会分配给文件描述符0 （分配过程看代码其实是一个顺序循环，0被释放后，再分配得新得文件肯定会重新被分配给0），此时cat 中得标准输入 已经被改为input.txt 。 这就是一个完整得文件重定向运用， 不得不感叹，其实现之巧妙，抽象得恰到好处，这也是我即使是一个前端也坚持学习操作系统得原因，就是想从先辈取经，明白程序应该怎么写怎么思考。

#### 管道

管道是一个小的内核缓冲区，作为一对文件描述符暴露给进程，一个用于读，一个用于写。将数据写入管道的一端就可以从管道的另一端读取数据。管道为进程提供了一种通信方式。

```c
struct pipe {
  struct spinlock lock;
  char data[PIPESIZE]; // PIPESIZE == 512
  uint nread;     // number of bytes read
  uint nwrite;    // number of bytes written
  int readopen;   // read fd is still open
  int writeopen;  // write fd is still open
};
```
从结构体中就可以看出，管道就是一个内核缓冲区，数据大小为512字节，它提供了一片读写区域供外部使用，并且管道内部读写是阻塞式得，也就是说 当你写入一个数据后，马上就能读出写入的数据，并且如果不把管道的所有写入文件描述符关闭，管道会一直等待读取数据。

具体管道的使用示例在xv6 book 第一章中有详细的描述，不再重复了，这里book描述的很清楚。

#### 参考

[https://zhuanlan.zhihu.com/p/350949057](https://zhuanlan.zhihu.com/p/350949057)
xv6 book 第一章


