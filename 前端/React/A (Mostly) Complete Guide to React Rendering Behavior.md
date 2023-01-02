
React18版本正式发布后，一直到今天，还没用认真了解过内部机制的变动，打算已这篇文章为起点，重新研究一下React内部机制的运行过程。

### re-render 执行流程

在文章对渲染行为阐述中特别强调了

> **Rendering a component will, by default, cause _all_ components inside of it to be rendered too!**


也就是，父组件的状态变动会触发所有的子组件的re-render，不管父子组件之间是否存在数据通信变动，核心目的是为了保障渲染一致。

> Remember, **rendering is not a _bad_ thing - it's how React knows whether it needs to actually make any changes to the DOM!**


所以，render区域的代码需要 safely pure ，不然会被重复执行多次，想象一下你在中间执行了一个网络请求，结果外部组件的状态变化让你子组件内部的网络请求疯狂被重新触发。。。

### 无处不在的 Snapshot 和 Closures

闭包react18中随处可见，一个典型的例子就是。

```typescript
function MyComponent() {
  const [counter, setCounter] = useState(0);

  const handleClick = () => {
    setCounter(counter + 1);
    // ❌ THIS WON'T WORK!
    console.log(counter);
    // log 0 not 1
    // Original value was logged - why is this not updated yet??????
  };
}
```

对react中 `state `需要重新有一个精准的认知，很容易混淆的地方在于，将 `State` 看作是普通的JS变量，认为只要调用了 `setter` 就能马上获得最新的值，比起变量 `State` 更像 一个 `Snapshot` ，在我的理解中，当前时刻的所有 `State` 都是无法改变的 你调用 `setter` 只是改变下一帧的 `Snapshot` 的值，因此，每一个函数组件在不同时刻都有自己的 `State` 彼此之间互不干涉。 
更详细的解释参考  [State as a Snapshot](https://beta.reactjs.org/learn/state-as-a-snapshot) 。

在这种模式下，还有一个典型的错误发生在 `useEffect` 中，`useEffect` 也是一个闭包，在其中的函数中，依然可以获取 `State` 的值，但是，`useEffect` 中 `State` 的值只会是依赖项未变时的值，只有当依赖性改变后，`useEffect` 函数体才能获取依赖项改变时外部 `State` 的值。因此，按照规范，`useEffect` 函数体中 使用的外部 `State` 值，是必须要添加到依赖项中的，而有时候因为业务复杂度关系，有的人为了避免重复执行而隐式的依赖外部变量的触发顺序来获取正确的值，这可能在后续迭代中产生bug。

### 内部状态与UI树结构强相关

之前，关于react 组件的挂载和卸载和状态 `useState` 我一直认为是和JSX标签的渲染有关，如果出现一下代码：
```typescript
import { useState } from 'react';

export default function App() {
  const [isFancy, setIsFancy] = useState(false);
  return (
    <div>
      {isFancy ? (
        <Counter isFancy={true} /> 
      ) : (
        <Counter isFancy={false} /> 
      )}
    </div>
  );
}

function Counter({ isFancy }) {
	....
}

```

当 **Counter **组件被重新渲染时，应该组件内部的会重新挂载和创建新的状态，然而组件内部的状态是与当前组件出现在整体** **`UI` 树的位置强相关的，如果位置不变，即像上述代码中一样，他的内部状态是会被保留的。

> It’s the same component at the same position, so from React’s perspective, it’s the same counter.


默认情况下，React内部已组件在UI树中的位置为主，通过给组件添加Key属性，可以避免这种情况发生。
