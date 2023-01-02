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
    let [j, r] = _partition(start, end)
    _sort(start, j)
    _sort(r, end)
  }
  //交换函数用于交换需要排列的数,只需要操作数组对应索引即可
  function swap(a, b) {
    [arr[a], arr[b]] = [arr[b], arr[a]]
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