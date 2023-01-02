## 前置知识

此次实验涉及到线程调度和锁，需要先熟悉 chapter 6 和chapter 7。特别是chapter 7 调度中关于线程切换得内容。

## 核心目的

整体lab分成三个，目的是让学生对多线程编程有一定的认识，包括其中的一些核心运用，锁，同步机制，信号等并发并行术语。

1. 实现用户级得线程切换（xv6-通过模仿内核得线程切换机制，实现用户级得线程切换）
2. 多线程情况下避免竞态条件被覆盖（非xv6）
3. 多线程情况下实现一个barrier（非xv6）


## 思路

**lab1：**该实验大体上是内核调度的用户空间实现，因此需要先对内核是如何调度要有一定得认知，要能够梳理内核调度经历得全流程，这里暂不详细描述内核调度过程，只是简单分解内核调度得过程。首先要知道xv6是一个多核运行的操作系统，多个cpu之间都有自己的寄存器和调度进程，这样才实现了真正的并行处理。

1. 每个cpu都有自己的调度进程，这个调度进程不是进程表中进程。
2. 通过trap或者sleep 最终会调用sched函数。
3. sched函数会将当前进程切换为cpu调度进程，然后调度进程选取进程表中进程，最后切换成选取的进程运行。
4. 而在切换进程中需要保留被切换进程的部分状态信息（**Callee-saved registers**）。

**lab2：**要了解锁和临界区，以及竞态条件的概念，其余的按照实验说明来即可了。

**lab3：**实现一个屏障函数，在多线程情况下，需要每个线程达到该函数才释放执行下一步，因此需要在这个函数中进行条件判断和阻塞，以及满足条件下唤醒其他已经睡眠的线程。


## Uthread: switching between threads


按照实验提示，我们需要修改地方分别是thread_create，thread_schedule，以及thread_switch ，通过这些函数名，以及测试函数，基本知道该实验就是实现一个用户级别的线程切换，通过模仿内核进程调度的方式。

1. thread_create，需要将传递给thread_create参数，运行在它们各自的线程栈中。
2. thread_schedule，负责调度所有的线程。
3. thread_switch ，保存和恢复线程的寄存器。

### thread_create

首先观察线程的结构体。

```c
/* Possible states of a thread: */
#define FREE        0x0
#define RUNNING     0x1
#define RUNNABLE    0x2

#define STACK_SIZE  8192
#define MAX_THREAD  4


struct thread {
  char       stack[STACK_SIZE]; /* the thread's stack */
  int        state;             /* FREE, RUNNING, RUNNABLE */

};
```

可以看出线程由自己的栈空间和线程状态组成，类似于内核调度，线程调度也需要设置对应的状态，同时也需要容器存放状态信息。


```c
void 
thread_create(void (*func)())
{
  struct thread *t;

  for (t = all_thread; t < all_thread + MAX_THREAD; t++) {
    if (t->state == FREE) break;
  }
  t->state = RUNNABLE;
  // YOUR CODE HERE
}
```
而thread_create函数的功能是找到一个线程，并将对应的执行函数放入到该线程中，因此后面线程调度时，能够执行对应的函数，首先要明白传递给thread_create的函数要保存在哪里，我们明白它只是一个函数地址而已，而且不同于lab trap实验中的alalrm，这里线程的结构体并没有一个字段来保存该函数地址，只有一个栈用来保存信息，但是栈是程序执行的空间不能用于存储对应的切换上下文（**栈内的空间在执行中会被不断覆盖**），因此需要增加一个字段用来保存上下文，可以参考内核调度中存放上下文的结构。

```c
struct thread {
  char       stack[STACK_SIZE]; /* the thread's stack */
  int        state;             /* FREE, RUNNING, RUNNABLE */
  struct context context; 
};
```

```c
# Context switch
#
#   void swtch(struct context *old, struct context *new);
# 
# Save current registers in old. Load from new.	


.globl swtch
swtch:
        sd ra, 0(a0)
        sd sp, 8(a0)
        sd s0, 16(a0)
        sd s1, 24(a0)
        sd s2, 32(a0)
        sd s3, 40(a0)
        sd s4, 48(a0)
        sd s5, 56(a0)
        sd s6, 64(a0)
        sd s7, 72(a0)
        sd s8, 80(a0)
        sd s9, 88(a0)
        sd s10, 96(a0)
        sd s11, 104(a0)
		....
		ld
        
        ret

```
这个是内核调度中的swtch 函数，我们可以看到它只保存和恢复了部分寄存器状态（**Callee-saved registers**），不同于trapframe，这点后续解释，而在内核调度需要保存的寄存器中，注意到**ra**寄存器，ra寄存器是返回地址寄存器（return address）它不同于pc寄存器但是有着类似的功能，即可以控制程序执行流。

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/frame.png#crop=0&crop=0&crop=1&crop=1&id=WINHW&originHeight=847&originWidth=1198&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

这是老师在课上的截图，显示了程序在运行中的执行方式和流程，我们可以看到每个函数执行完毕后，需要返回到执行该函数位置的下一行地址，而这个地址就放在ra（return address）寄存器中，因此对thread_create函数中被传递进来的执行函数，我们只需要将它的地址放在ra中，通过后续swtch时，就可以正确执行到对应要执行函数的地址了。

```c
void 
thread_create(void (*func)())
{
  struct thread *t;

  for (t = all_thread; t < all_thread + MAX_THREAD; t++) {
    if (t->state == FREE) break;
  }
  t->state = RUNNABLE;
  // YOUR CODE HERE
  t->context.ra = (uint64)func;
  // 记得栈是从高到低的，因此要加上栈的size
  t->context.sp = (uint64)t->stack + STACK_SIZE;
}
```

### thread_schedule和thread_swtch

其实这里和内核调度基本一致，按照内核调度就可以了。


## 总结

该实验整体难度都比较低，lab1 只要熟悉内核调度机制基本就没问题，而剩余的两个非xv6环境实验，需要了解一些多线程编程的知识体系，这两个非xv6环境实验的目的也就是让你去了解真正的多线程编程会面临那些问题，以及当前的通用解决方案和基本术语，我目前对多线程编程的了解非常少，基本都只是来自于xv6和当初看操作系统导论提及到的部分知识，目前的工作环境主要是单线程，天然对多线程编程有一种陌生和恐惧感，后期应该系统学习多线程编程，以c或者rust语言入手，了解多线程编程的方式和应用。

1. 重新复习一下CSAPP第三章 程序的机器级表示。
2. 系统学习多线程编程及术语。


