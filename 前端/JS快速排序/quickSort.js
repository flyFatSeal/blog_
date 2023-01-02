function quickSort(nums) {
  _sort(0, nums.length - 1)
  return nums

  //递归分组函数
  function _sort(start, end) {
    //递归终止条件
    if (start > end) return
    let p = _partition(start, end)
    //此时p所在的元素已经排好序
    _sort(start, p - 1)
    _sort(p + 1, end)
  }
  //对给定数组的范围排序基准数
  function _partition(start, end) {
    //拿到基准数
    const value = nums[start]
    let j = start
    // 保证 nums[start+1...j] < value ; nums[j+1...end] > value
    for (let i = start + 1; i <= end; i++) {
      if (nums[i] < value) {
        swap(i, ++j)
      }
    }
    //交换j和基准数，让基准数处在应该的位置
    swap(j, start)
    //返回已经排好序基准数的索引
    return j
  }
  //交换函数
  function swap(a, b) {
    [nums[a], nums[b]] = [nums[b], nums[a]]
  }
}