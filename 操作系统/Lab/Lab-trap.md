
## 前置知识

本次实验注意涉及到xv6 trap机制的具体细节，请参考xv6 book chapter 4 trap。

## 核心目的

仿照trap流程实现一个用户级别的trap处理，实现 **sigalarm(interval, handler)  和 sigreturn **系统调用，**sigalarm**有两个参数，一个是时间片多少，一个是处理函数，当过了指定时间片后，立马执行对应的回调函数。

## 思路

其实lab4的核心需求就是实现一个用户级别的trap，这里需要参考现有的trap流程，特别是在用户空间执行系统调用时的整体流程。

1. 用户空间代码如何陷入内核态
2. 执行完系统调用后，如何返回到用户空间中
3. 如何在用户态和内核态的切换中保存状态，以达到让程序无感切换
4. 各个关键寄存器的转变节点在哪里（pc，ra，epc，sp，sterve）

这三点其实我还是处于半懂不懂的状态，需要仔细阅读charpt4 章节的内容，并且手动debug 走几遍运行流程。除此之外，在初次看到该lab要求时，还有以下几点困惑

1. 用户空间下对应trap的回调函数（handler），在进入内核态时，如何执行，此时是不是要将上下文恢复到用户空间中的状态。（**是的，必须要把寄存器恢复到用户空间，不然转换不了handler函数的地址**）
2. sigreturn 有啥用。（**sigreturn会在handler结束后调用，是用于恢复执行handler之前寄存器状态的函数，特别是 pc 寄存器**）
3. 为了不干扰后续的trap执行流，是不是要把当前进程用户状态的数据保存两份。（**是的，要新增一个类似trapframe的容器页，用来保存执行handler函数前的寄存器状态，不然执行handler会修改掉部分寄存器状态**）


## 问题

### 内核态和用户态如何相互切换

需要在**usertrap**函数中处理和触发sigalarm系统调用储存的hanlder函数，此时应该要把上下文环境恢复到用户态中，不然拿不到实际handler函数的地址，并且这个函数还有可能会修改用户态的部分数据，所以需要注意如何避免该函数执行过程中对寄存器状态的干扰。

```c
 // trap.c -> usertrap 
 if(which_dev == 2){
    if( p->ticks != 0){
      // exec alarm handler function
      if(p->curtick == p->ticks && p->isalarm == 0){
        // 满足执行handler函数的情况下 要做什么样的处理
        ....
      }
      else
      {
        if(p->isalarm == 0)
          p->curtick += 1;
        else
          p->curtick = 0;
      }
    }
    yield();
  }
```
所以，先实现如何在内核态中将上下文环境恢复到用户态，需要先参考正常trap流程中，用户态和内核态相互转化的步骤和执行流程。

回归到正常流程的trap处理机制。

#### 用户态进入内核态

当一个用户进程调用系统调用时，它会从用户态陷入到内核态，大致经历以下几个步骤。它首先会执行ecall指令，ecall指令执行流程如下。

1. 如果造成trap的是设备中断，将sstatus中的SIE位清0，然后跳过以下步骤。
2. （如果trap的原因不是设备中断）将sstatus中的SIE位清0，关闭设备中断。
3. 将pc的值复制到sepc中。
4. 将发生trap的当前模式（用户模式或监管者模式）写入sstatus中的SPP位。
5. 设置scause的内容，反映trap的起因。
6. 设置模式为监管者模式（注意，此时只是将权限提升至内核级别，但是页表并没有发生切换）。
7. 将stvec的值复制到pc中（每个进程的在初始化的时候都会将寄存器stvec指向trampoline.s的uservec）。
8. 从新的pc值开始执行。

因此在发生trap时，pc指针被替换为stvec寄存器，而stvec寄存器的值指向trampoline.s 的uservec，此时程序执行流跳转到uservec。

而uservec会做以下工作

1. 将当前a0寄存器和sscratch寄存器的值进行交换，交换后原本a0寄存器的值指向当前进程的trapframe
2. 将当前用户空间下的寄存器保存至trapframe页中（包括原本a0寄存器，具体参考uservec代码）
3. 恢复一些内核信息（sp，cpuid，usertrap，内核stap）
4. 将页表切换为内核页表，并把原本用户空间的页表保存到寄存器t1中
5. 跳转到usertrap的地址开始执行函数（**此刻完全由用户态陷入到内核态，接下来的执行流程由内核掌控**）


#### 内核态进入用户态

当系统调用完成后，需要由内核态返回到用户态中，并且要携带系统调用函数的返回值和恢复到之前陷入到内核态时用户空间下的下一个执行地址。
内核态返回到用户态是从usertrap函数中调用usertrapret函数开始（**usertrap->usertrapret->userret**），简要分析一下步骤

1. 关闭中断，重置stvec寄存器指向uservec（**此时stvec指向kernelvec，如果不关闭中断很可能出现在stvec 指向uservec 后系统内核中断，这种情况下就无法正确处理中断了，因此需要关闭中断**）
2. 重新保存内核信息到trapframe中（cpuid，内核栈，页表，kerneltrap）
3. 重置sstatus，打开中断（**这里的中断是外部触发的中断，不是在内核运行时可能出现的中断**）。
4. 重置sepc指针，让它指向之前用户空间下的地址
5. 执行userret函数


userret函数

1. 切换页表，转化为用户进程页表
2. 将之前保存在trapframe中的寄存器恢复
3. 调用sret 将sepc和pc寄存器互换，至此程序执行流恢复到用户空间

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/xv6-trap.png#crop=0&crop=0&crop=1&crop=1&id=OFRtL&originHeight=736&originWidth=1440&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

#### 一些特殊寄存器在trap流程中的变化

**特别注意：**在替换这些关键寄存器的值之前，我们需要明白在替换前这些寄存器的值是什么，并且它们在原有正常trap流程中，是处于那个阶段，防止出现寄存器在trap流程中出现混乱。

**sepc：**在trap发生后，用户态下，程序执行流的下一行地址（PC的值）会被硬件保存到sepc中，并且在trap流程中，用户态下的pc值会被保存到p->trapframe->epc中，通过usertrapret函数，将用户态下的pc值恢复到sepc寄存器中，最后在useret中调用sret将sepc的值写入到pc中。因为该寄存器是通过中间变量（p->trapframe->epc）来保存的。

**stvec：**在进程初始化时会被设置为uservec，在trap进入到usertrap函数后会被设置为kernelvec，随后在usertrapret时再被设置为uservec。

### usertrap中如何转化上下文并且不相互干扰


在正常的trap流程中，由内核态转换为用户态是通过**usertrapret**函数来进行的 该函数最后会通过调用trampoline.S中的useret函数来执行恢复用户态状态操作。

```c
//
// return to user space
//
void
usertrapret(void)
{
  struct proc *p = myproc();

  // we're about to switch the destination of traps from
  // kerneltrap() to usertrap(), so turn off interrupts until
  // we're back in user space, where usertrap() is correct.
  intr_off();

  // send syscalls, interrupts, and exceptions to trampoline.S
  w_stvec(TRAMPOLINE + (uservec - trampoline));

  // set up trapframe values that uservec will need when
  // the process next re-enters the kernel.
  p->trapframe->kernel_satp = r_satp();         // kernel page table
  p->trapframe->kernel_sp = p->kstack + PGSIZE; // process's kernel stack
  p->trapframe->kernel_trap = (uint64)usertrap;
  p->trapframe->kernel_hartid = r_tp();         // hartid for cpuid()

  // set up the registers that trampoline.S's sret will use
  // to get to user space.
  
  // set S Previous Privilege mode to User.
  unsigned long x = r_sstatus();
  x &= ~SSTATUS_SPP; // clear SPP to 0 for user mode
  x |= SSTATUS_SPIE; // enable interrupts in user mode
  w_sstatus(x);

  // set S Exception Program Counter to the saved user pc.
  w_sepc(p->trapframe->epc);

  // tell trampoline.S the user page table to switch to.
  uint64 satp = MAKE_SATP(p->pagetable);

  // jump to trampoline.S at the top of memory, which 
  // switches to the user page table, restores user registers,
  // and switches to user mode with sret.
  // 此处fn执行trampoline 中的useret 函数
  uint64 fn = TRAMPOLINE + (userret - trampoline);
  ((void (*)(uint64,uint64))fn)(TRAPFRAME, satp);
}
```

```c
.globl userret
userret:
        # userret(TRAPFRAME, pagetable)
        # switch from kernel to user.
        # usertrapret() calls here.
        # a0: TRAPFRAME, in user page table.
        # a1: user page table, for satp.

        # switch to the user page table.
        csrw satp, a1
        sfence.vma zero, zero

        # put the saved user a0 in sscratch, so we
        # can swap it with our a0 (TRAPFRAME) in the last step.
        ld t0, 112(a0)
        csrw sscratch, t0

        # restore all but a0 from TRAPFRAME
        ....

	# restore user a0, and save TRAPFRAME in sscratch
        csrrw a0, sscratch, a0
        
        # return to user mode and user pc.
        # usertrapret() set up sstatus and sepc.
        sret
```
仔细观察usertrapret函数的最后几行，将sepc设置为p->trapframe->epc，在useret函数执行完后调用sret指令会将pc寄存器的值设置为p->trapframe->epc，因此我们只需要在满足执行handler条件的时候，将p->trapframe->epc设置为handler函数的地址，这样就可以在useret返回用户空间后，将程序执行流跳到sigalarm系统调用设定好的回调函数的地址。（**但是一定要保存好原有用户空间中断后恢复的地址，不然执行顺序就乱了，而通过memove，我们将替换前的p->trapframe->epc保存到了alarm的容器页中**）

```c
  // give up the CPU if this is a timer interrupt.
  if(which_dev == 2){
    if( p->ticks != 0){
      // exec alarm handler function
      if(p->curtick == p->ticks && p->isalarm == 0){
        // 将trapframe中的状态 copy一份到alarmframe 中，方便sigreturn恢复状态。
        memmove(p->alarmframe, p->trapframe, PGSIZE);
        // 替换掉之前的epc寄存器，将它设置为handler的地址，这样usertrapret就会把handler设置为
        // sepc寄存器的值了
        p->trapframe->epc = p->handler;
        // 表示handler函数正在执行中。
        p->isalarm = 1;
      }
      else
      {
        if(p->isalarm == 0)
          p->curtick += 1;
        else
          p->curtick = 0;
      }
    }
    yield();
  }
```

此时，代码已经能通过test0了，剩下还需要做的就是执行完handler以后返回内核空间并且重置进程trapframe的值，将它恢复到执行handler之前，这里的工作由sigreturn系统调用保证。

sigreturn会在每次handler调用结束后执行，具体代码可以参考alarmtest。

```c
uint64
sys_sigreturn (void)
{
  struct proc *p = myproc();
  // 重置状态值
  p->curtick = 0;
  p->isalarm = 0;
  // 恢复执行handler函数前trapframe的状态
  memmove(p->trapframe, p->alarmframe, PGSIZE);
  return 0;
}
```

至此，alarm lab整体完成，测试通过。

## 总结

该实验代码量少，但是需要理清xv6 trap的整体流程和关键寄存器（setp，stvec）的变更节点，如若，还是不理解建议多看几遍 chapter 4。

## 参考链接



