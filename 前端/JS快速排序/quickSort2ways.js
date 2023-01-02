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

quickSort([1, 2, 3])