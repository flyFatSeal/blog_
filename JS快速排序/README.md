# JS快速排序
本文将review快速排序算法从基础的快速排序到优化后的排序，对自身的知识做一个汇总和复习

## 一：快速排序算法

### **快速排序(Quick Sort)**


**原理**：在数组中选定一个基准数（一般是数组第一个元素），以基准数为对比值，将比它小的数放在基准数的前面，比它大的数放在基准数的后面，也就是把数组分为两块，一块是小于基准数的区域，一块是大于基准数的区域。
*****
**实现思路**：首先思考为什么要以基准数（value）将数组分为两部分，通过以基准数为标准的划分，左边的数组都小于它，右边的数组都大于它，那么此时的基准数就恰好的找到了数组排序后它应该待的位置。然后不断递归划分直到数组的长度为1，排序完成,所有的元素都呆在了合适的位置。因此我们需要声明一个索引指针（j）它要维护的性质就是索引前面的值小于基准值，后面的大于基准数（nums[start+1...j]< value ; arr [j...end]>value）。j的初始值为第一个数组元素的索引，从第二个数组元素起开始遍历整个数组，当第i个索引的值小于基准值时，nums[j]和nums[i]交换，同时j++。遍历到最后时j的位置就是基准值在排序后应该在的位置，此时交换nums[j]和value。返回j为下一次递归表明界限。因此我们需要三个功能子函数来实现快排，分别是对数组进行递归分组的函数（_sort），对给定范围排序的函数（_partition）,交换数组元素的函数（_swap）
<br>
![Image text](https://github.com/flyFatSeal/blog_/blob/master/JS%E5%BF%AB%E9%80%9F%E6%8E%92%E5%BA%8F/img/quick.png)
<br>
**代码实现**：
```javaScript
function quickSort(arr){
  _sort(0,arr.length-1)
  return arr

  //递归分组函数
  function _sort(start,end){
    //递归终止条件
    if(start>end) return
    let p = _partition(start,end)
    //此时p所在的元素已经排好序
    _sort(start,p-1)
    _sort(p+1,end)
  }
  //对给定数组的范围排序基准数
  function _partition(start,end){
    //拿到基准数
    const value = arr[start]
    let j = start
    // 保证 arr[start+1...j] < value ; arr[j+1...end] > value
    for(let i = start+1;i<=end;i++){
      if(arr[i]<value){
        swap(i,++j)
      }
    }
    //交换j和基准数，让基准数处在应该的位置
    swap(j,start)
    //返回已经排好序基准数的索引
    return j
  }
  //交换函数
  function swap(a,b){
    [arr[a],arr[b]] = [arr[b],arr[a]]
  }
}

```
以上就是基础的快速排序算法代码，然而从网上的资料可知，快速排序是不稳定的排序算法，在极端条件下，它的时间复杂度会退化到O(n^2)的程度，因此还需要针对不稳定的条件进行优化。

## 双路快排(Quick 2ways)

**不稳定条件分析：**
   
* 基准数位置的不稳定：在基础的排序算法中我们取数组的第一个元素为基准数，然而在实际情况中很有可能第一个元素就是排好序的元素，那么再对排好序的元素进行排序，就会导致性能的浪费。同时，基准数如果是一个过大或者过小的元素，就会让划分的左右数组极度不平衡。
   
* 重复元素导致的不平衡：由快排的思路可以知道是通过基准数划分为左右两个数组在进行递归，然而在数组拥有大量重复元素时，此时划分出来的左右数组严重失衡。这个时候快排就会退化到O(n^2)。
   
* 数组过大导致溢栈：受于浏览器性能限制，对于过深的递归会导致溢栈错误，在快排中使用的_sort函数对数组分组，同样存在着这类问题

**优化方案：**

* 随机基准数： 在数组中随机取一个基准数，然后与第一个元素交换位置。

* 双路快排： 在基础的快排中我们只处理了小于基准数的情况，为了让大量重复元素下划分的左右数组平衡，在循环处理中增加一个指针r它维护（nums[r...end]>v），让小于v的数放在左边，大于v的放在右边，中间放等于v的元素，此时数组被划分为三部分(|arr[start...j]<v| (j...r) =v | arr[r...end] >v |)，然后让j++，r--，直到相遇，此时左右两部分就近乎平分了中间等于v的区域，让划分的左右数组趋于平衡。

* 小数组插入排序： 对于数组长度在15以内的排序使用插入排序，在数组偏小时，插入排序的性能表现优于快速排序，同时可以解决递归过深的问题。
<br>
![Image text](https://github.com/flyFatSeal/blog_/blob/master/JS%E5%BF%AB%E9%80%9F%E6%8E%92%E5%BA%8F/img/quick2.png)
<br>

**优化代码实现**：

```javaScript
function quickSort(arr) {
  _sort(0, arr.length - 1)
  return arr
  //递归把数组分组
  function _sort(start, end) {
    if (end - start <= 15) {
      insertSort(start, end)
      return
    }
    //partition函数：给定的数组范围把数组按照基准数分列,让基准数排列在它应该在的位置
    let p = _partition(start, end)
    _sort(start, p - 1)
    _sort(p + 1, end)
  }
  //交换函数用于交换需要排列的数,只需要操作数组对应索引即可
  function swap(a, b) {
    [arr[a], arr[b]] = [arr[b], arr[a]]
  }
  //按照基准数划分数组
  function _partition(start, end) {
    //优化随机基准点
    swap(start, Math.floor(Math.random() * (end - start + 1) + start))
    //两个指针指向头部和尾部将数字划分为三块，小于等于v一块等于v一块，大于等于v一块避免数字出现大量重复元素时，快速排序退化到n平方的复杂度
    let j = start + 1,
      r = end,
      value = arr[start]
    while (true) {
      //排序出小于v和大于v的区域
      while (j <= end && arr[j] < value) j++
      while (r >= start + 1 && arr[r] > value) r--
      //循环结束条件，i指针大于r指针,遇到重复元素
      if (j > r) break
      swap(j, r)
      j++
      r--
    }
    swap(start, r)
    return r
  }

  function insertSort(start, end) {
    for (let i = start + 1; i <= end; i++) {
      //排序nums【i】，当前面元素大于nums[i]时，元素后移，到合适位置时赋值nums【i】
      let e = arr[i],
        j
      for (j = i; j > 0 && arr[j - 1] > e; j--) {
        arr[j] = arr[j - 1]
      }
      arr[j] = e
    }
  }

}
```

然而在优化后的双路快排上还可以进一步优化。

## 三路快排(Quick 3ways)

**优化方案**

在上面的代码中，对重复元素的处理是左边数组和右边数组平分中间重复元素的区域让划分出的数组近乎平衡，然后再进行新一轮的递归调用，然而实际上对排序中出现的重复元素来说，它已经处在自己应该的位置，不需要在对重复元素进行又一次排序，因此可以放弃中间重复区域的排序，在递归中返回左边界的结束指针（j）和右边界的结束指针（r）。让下一次的排序从[start,j-1]和[r+1,end]开始。

<br>
![Image text](https://github.com/flyFatSeal/blog_/blob/master/JS%E5%BF%AB%E9%80%9F%E6%8E%92%E5%BA%8F/img/quick3ways.png)
<br>

**实现思路**

和双路快排一致，不过在原有j和r指针的基础上增加一个新的指针i，在三路快排中，[start+1...j] < v ; (j...r) == v ; [r...end] > v。只要维护好三个指针的性质最后返回j和r，即可实现三路快排。

**代码实现**

```javaScript
//函数直接操作数组指针不需要返回值
function quickSort(arr) {
  _sort(0, arr.length - 1)
  return arr
  //递归把数组分组
  function _sort(start, end) {
    if (end - start <= 15) {
      insertSort(start, end)
      return
    }
    //partition函数：返回j,r指针避免对重复元素的再排序。
    let [j, r] = _partition(start, end)
    _sort(start, j)
    _sort(r, end)
  }
  //交换函数用于交换需要排列的数,只需要操作数组对应索引即可
  function swap(a, b) {
    //同双路快排代码一致
  }
  //按照基准数划分数组
  function _partition(start, end) {
    //优化随机基准点
    swap(start, Math.floor(Math.random() * (end - start + 1) + start))
    //
    let j = start //arr[start+1...j] < v
    let r = end + 1 //arr[r...end] > v
    let i = start + 1 //arr[j+1...i) == v
    let value = arr[start]
    //循环中的操作都是维护j，i，r的范围性质
    while (i < r) {
      if (arr[i] < value) {
        swap(i, j + 1)
        j++
        i++
      } else if (arr[i] > value) {
        swap(i, r - 1)
        r--
      } else {
        i++
      }
    }
    swap(start, j)
    return [j, r]
  }

  function insertSort(start, end) {
    //同双路快排代码一致
  }

}

```

**总结**

快速排序是当下运用最广泛的排序算法，同时也是javaScript数组原生Sort方法的底层实现（v8是用的快速排序），基础的了解是必要的
















