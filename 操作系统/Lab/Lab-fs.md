## 前置知识

本次实验涉及到 xv6中的文件系统需要提前阅读完 Chapter 8: File system


## 核心目的

实验分为两个

1. lagre file  扩展xv6的文件大小，修改原有inode结构，增大单个文件的容量。
2. symboils link 实现软链接功能。

从两个实验来看，该lab主要要求学生增加对xv6文件系统的了解，明白文件系统中各自的分层关系，以及核心函数的用途，但是并没有涉及到篇幅最多的文件系统一致性保障实现。

## Large File

首先简单梳理一下xv6文件系统的一些概念和结构体之间的关系，什么是文件系统，就是实现**持久性存储**的一个系统，而在持久性这个基本目的上还要实现一些特性来更好的支撑文件系统工作，现xv6中就实现了以下特性：

1. 类unix风格，有文件名和文件目录。
2. 支持崩溃恢复，保障极端情况下的数据一致性。
3. 支持多线程操作。
4. 有缓存机制，减少和硬盘交互的。

而且持久性缓存就意味这在发生断电，重启等情况下，数据依然存储完整，因此在xv6中，它表现为一段连续的数据块区域，而在这个区域中，又分布划分了不同的结构区。

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/layout.png#crop=0&crop=0&crop=1&crop=1&id=zXbqc&originHeight=180&originWidth=720&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

其他区域暂不解释，只说一下inodes，什么是inodes，简单来说inode就是一个文件的信息集合体，它维护它对应文件的信息，包括大小，引用数，对应的数据块有哪些等等。而在large file lab中，最主要的就是处理inode和它对应的数据块的关系。


在原有文件系统设计中，单个文件最大只能是12+256 kb，这是由inode本身结构导致的，inode的数据分布在data字段中，data字段内部分为两种数据区

1. 直接引用数据块（12个）。
2. 间接引用数据块（用一个直接引用数据块做间接引用数据块 256个）
3. 每个数据块的大小是1024b。

在该实验中要求扩展inode结构，将单个文件的大小扩展到65803kb（256*256+256+11）

### 思路

思路在实验说明中已经解释的相当清楚了，既然要扩充文件的大小，那就是要增加单个inode能引用到的数据块数量了，在原有设计中有一个间接引用，那么可以再占用掉一个直接引用块，把它变成间接引用的间接引用，这样就能增加256*256个数据块的数据引用了。

xv6中将逻辑块号转换为物理块号的过程是定义在bmap函数中，首先看一下原有bmap函数的执行流程。

```c
// Inode content
//
// The content (data) associated with each inode is stored
// in blocks on the disk. The first NDIRECT block numbers
// are listed in ip->addrs[].  The next NINDIRECT blocks are
// listed in block ip->addrs[NDIRECT].

// Return the disk block address of the nth block in inode ip.
// If there is no such block, bmap allocates one.
static uint
bmap(struct inode *ip, uint bn)
{
  uint addr, *a;
  struct buf *bp;

  if(bn < NDIRECT){
    if((addr = ip->addrs[bn]) == 0)
      ip->addrs[bn] = addr = balloc(ip->dev);
    return addr;
  }
  bn -= NDIRECT;

  if(bn < NINDIRECT){
    // Load indirect block, allocating if necessary.
    if((addr = ip->addrs[NDIRECT]) == 0)
      ip->addrs[NDIRECT] = addr = balloc(ip->dev);
    bp = bread(ip->dev, addr);
    a = (uint*)bp->data;
    if((addr = a[bn]) == 0){
      a[bn] = addr = balloc(ip->dev);
      log_write(bp);
    }
    brelse(bp);
    return addr;
  }

  panic("bmap: out of range");
}
```

从代码中，我们可以看出bmap大致的内容：

1. 目的：将逻辑块号转换为物理块号，以提供给上层函数使用。
2. 特点：按需分配，不是在初始化时就将268个数据块全部分配，而是在需要的时候在去分配。

按照实验提示，直接增加新的双向间接引用块即可。

首先要更新一下一些宏

```c
#define NDIRECT 11
#define NINDIRECT (BSIZE / sizeof(uint))
#define NDOUBLEINDIRECT (NINDIRECT * NINDIRECT)

#define MAXFILE (NDIRECT + NINDIRECT + NDOUBLEINDIRECT)
```

```c
  bn -= NINDIRECT;

  if(bn < NDOUBLEINDIRECT){
    // Load double indirect block , allocating
    if((addr = ip->addrs[NDIRECT + 1]) == 0)
      ip->addrs[NDIRECT + 1] = addr = balloc(ip->dev);
    bp = bread(ip->dev, addr);
    // a now is a doublely indirect
    a = (uint*)bp->data;

    int level1, level2;

    level1 = bn / NINDIRECT; 
    level2 = bn % NINDIRECT;

    if((addr = a[level1]) == 0)
       a[level1] = addr = balloc(ip->dev);
    dbp = bread(ip->dev, addr);
    da = (uint*)dbp->data;
    
    if((addr = da[level2]) == 0){
      da[level2] = addr = balloc(ip->dev);
      log_write(bp);
      log_write(dbp);
    }
    brelse(bp);
    brelse(dbp);
    return addr;
  }
```

需要注意的地方有：

- 要区分数据块和buf块，如果是填充的buf块要记得调用log_write同步缓存和磁盘内容。
- 有bread就要用brelse，两个函数是同步出现的，这样才能让buf块的refcnt值正确。


## Symbolic Link

新增一个软链接（符号链接）的系统调用，并通过测试，在当前lab要求下软链接和硬链接定义如下。

- 硬链接（link，unlink）：一个文件指向另一个文件，但是这两个文件必须位于同一块磁盘。
- 软链接（symlink）：一个文件指向另一个文件，两个文件不要求磁盘一致。

### 文件调用

既然涉及到新增一个新的文件系统调用，那起码要先梳理一下现有xv6的文件系统调用的大致流程，这个梳理主要说明以下问题：

1. 文件操作的大致流程。
2. 流程中的关键节点（如何转化逻辑块号到物理块号，详情见large file）。
3. 文件的目录结构是怎么实现的。
4. 怎么按照目录结构递进搜索。

#### 大致结构

首先要清楚，在xv6中对文件执行实际操作（读，写）是通过文件描述符进行的，而文件描述符的本质就是当前进程open file 数组的索引值，而进程open file 数组中每个元素是一个file结构体。

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
这个结构体中就有该文件对应的inode指针，通过这个指针就可以拿到对应的物理块，从而执行读写操作。

#### 文件目录结构

xv6实现了类unix的层级目录结构，在这里简单描述一下层级目录结构在inode和实际物理块之间是如何实现的，首先，在上几个章节描述中我们已经确认了，inode会有一个data区域用来储存当前文件占用的实际物理地址，这个描述目录结构的结构体就是dirent。

```c
// Directory is a file containing a sequence of dirent structures.
#define DIRSIZ 14

struct dirent {
  ushort inum; // 这个目录指向的inode编号
  char name[DIRSIZ]; // 目录名
};
```

inode中目录的结构图如下：

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/os/inode.png#crop=0&crop=0&crop=1&crop=1&id=irh4J&originHeight=324&originWidth=512&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

xv6中的目录结构就是这样一层一层连接而成，例如从当前目录中根据name找到下一层目录的inode 索引，然后再根据这个**inum**找到下下层的**inode**索引，直到最后。

```c
// Look up and return the inode for a path name.
// If parent != 0, return the inode for the parent and copy the final
// path element into name, which must have room for DIRSIZ bytes.
// Must be called inside a transaction since it calls iput().
static struct inode*
namex(char *path, int nameiparent, char *name)
{
  struct inode *ip, *next;

  if(*path == '/')
    ip = iget(ROOTDEV, ROOTINO);
  else
    ip = idup(myproc()->cwd);

  while((path = skipelem(path, name)) != 0){
    ilock(ip);
    if(ip->type != T_DIR){
      iunlockput(ip);
      return 0;
    }
    if(nameiparent && *path == '\0'){
      // Stop one level early.
      iunlock(ip);
      return ip;
    }
    if((next = dirlookup(ip, name, 0)) == 0){
      iunlockput(ip);
      return 0;
    }
    iunlockput(ip);
    ip = next;
  }
  if(nameiparent){
    iput(ip);
    return 0;
  }
  return ip;
}
```

namex函数最主要的就是 **skipelem **和 **dirlookup** 

- **skipelem： 根据完整的路径，一层层取出目录名。**
- **dirlookup：遍历当前inode下储存的所有目录，根据目录名找到下一层inode的索引。**




### 硬链接

要实现软链接，需要先来梳理一下硬链接的执行流程。

```c
// Create the path new as a link to the same inode as old.
uint64
sys_link(void)
{
  char name[DIRSIZ], new[MAXPATH], old[MAXPATH];
  struct inode *dp, *ip;

  if(argstr(0, old, MAXPATH) < 0 || argstr(1, new, MAXPATH) < 0)
    return -1;
  // 直接开启事务，因为硬链接可能涉及到多次得硬盘io操作，如果不用事务包起来，
  // 很可能出现部分中断，导致文件系统损坏。
  begin_op();
  // 直接通过namei函数找到被链接文件得inode编号和地址
  if((ip = namei(old)) == 0){
    end_op();
    return -1;
  }
  // ilock 给ip上锁同时保证同步磁盘信息到内存中。
  ilock(ip);
  // 不能给目录添加硬链接。
  if(ip->type == T_DIR){
    iunlockput(ip);
    end_op();
    return -1;
  }
  // nlick 是硬链接得连接数和refcnt不同
  ip->nlink++;                                         
  // inode缓存变化必须马上更新到对应得磁盘中
  iupdate(ip);
  iunlock(ip);
  // 找到新路径得父目录的inode 并且把路径最后一级名称赋给name。
  if((dp = nameiparent(new, name)) == 0)
    goto bad;
  ilock(dp);
  // dp 是新路径父目录的inode地址，这里面dirlink主要作用是把旧节点得inode number
  // 写入到新路径得目录结构中，从此建立一个映射关系，能从新节点得inode直接链接到旧节点，
  // 实质就是把旧inode得编号直接拷贝到新inode对应路径得目录结构中
  // 至此工作完成。
  if(dp->dev != ip->dev || dirlink(dp, name, ip->inum) < 0){
    iunlockput(dp);
    goto bad;
  }
  iunlockput(dp);
  iput(ip);

  end_op();

  return 0;

bad:
  ilock(ip);
  ip->nlink--;
  iupdate(ip);
  iunlockput(ip);
  end_op();
  return -1;
}
```

通过分析sys_link 得系统调用函数，我们可以很清晰得知道，实现硬链接得核心步骤就是

1. 首先找到旧文件得inode地址，ip = namei(old)。
2. 找到新文件路径上一层节点得inode地址，dp = nameiparent(new, name)。
3. 然后将旧文件得inode编号复制给新文件，这样就建立了新旧文件得映射关系。



### 软链接


在硬链接中，例如 /test/b 链接到 /test/a 中，这两个文件都属于**test**目录下，但是**/test/b** 只作为dirent结构存储在 /test 目录对应inode 下的 address中，并不存在一个单独的**/test/b** inode，而**/test/a** 是存在一个对应的inode，所以在硬链接中链接目录是不存在inode结构。

然而目前根据软链接的部分要求：

1. 需要有对应的type（T_SYMLINK）来表示该inode为软链接。
2. 如果对一个软链接再进行一个软链接需要递归寻找。

因此在调用软链接时应该要生成一个对应的inode，同时为了链接到指定的文件，也需要将被链接的文件路径存储在链接文件的inode下。

```c
uint64
sys_symlink(void)
{
  char new[MAXPATH], old[MAXPATH];
  struct inode *dp;

  if(argstr(0, old, MAXPATH) < 0 || argstr(1, new, MAXPATH) < 0)
    return -1;

  begin_op();

  // 注意create 调用会返回一个已经被上锁的inode
  // 而namei 调用返回的是一个没上锁的inode。
  if((dp = namei(new)) == 0)
    dp = create(new, T_SYMLINK, 0, 0);
  else
    ilock(dp);
  // 将被链接文件路径存放在inode的数据区中 ip->data
  if (writei(dp, 0,(uint64)&old, 0, sizeof(char [MAXPATH])) != sizeof(char [MAXPATH]))
  {
    iunlockput(dp);
    goto bad;
  }
  iunlockput(dp);

  end_op();

  return 0;

bad:
  end_op();
  return -1;
}
```

为了防止软链接彼此之间互相链接形成循环，需要在open调用中判断这个情况。

```c
uint64
sys_open(void)
{
  char path[MAXPATH];
  int fd, omode;
  struct file *f;
  struct inode *ip;
  int n;

  if((n = argstr(0, path, MAXPATH)) < 0 || argint(1, &omode) < 0)
    return -1;

  begin_op();

  if(omode & O_CREATE){
    ....
  }
  else {
    if((ip = namei(path)) == 0){
      end_op();
      return -1;
    }
    ilock(ip);
    if(ip->type == T_SYMLINK && (omode & O_NOFOLLOW) == 0){
      int loop = 0;
      while (ip->type == T_SYMLINK)
      {
        char linkpath[MAXPATH];
        if(readi(ip, 0, (uint64)&linkpath, 0, sizeof(char [MAXPATH])) != sizeof(char [MAXPATH]))
          panic("symlink read");
        iunlock(ip);
        ip = namei(linkpath);
        if(loop++ >= 10 || ip == 0 ){
          end_op();
          return -1;
        }
        ilock(ip);
      }
    }
    if(ip->type == T_DIR && omode != O_RDONLY){
      ....
    }
  }
  ....
  return fd;
}

```

在open调用中要特别注意对inode 上锁和解锁的函数调用，不然很容易出现死锁和反复获取锁报错。

软链接逻辑上和硬盘无关，为了达到这个要求，其实应该在存储被链接文件路径时，将被链接文件的硬盘号（ip->dev）也储存在inode的数据区中，但是因为涉及到路径寻找的一系列函数(**namei **, **dirlookup**, **namex**) 都没有涉及到设备硬盘号的判断（xv6只支持一个储存设备），因此偷了懒没有挨个添加对设备号的判断。


## 总结

fs lab 整体难度偏低，主要目的还是让大家熟悉xv6文件系统的形成方式和目录结构，而关于视频教学中难度最大花费时间最多的文件一致性保障和优化性能方式并没有涉及到，后续如果有时间可以按照教授讲解的方式尝试优化事务日志，提高文件读写性能，这点才是xv6文件系统中相对较难的部分。






