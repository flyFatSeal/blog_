
### 操作对象的属性，通过返回never过滤不想要的属性。

1.  1367 - Remove Index Signature
2.  2595 - PickByType
3.  8 - ReadOnly 2

```typescript
type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never ] : T[P]
}

// 通过[P in keyof T as .....] 就可以直接过滤不符合条件的属性。(filter)
```

### 可以用范形做结果存储

```typescript
type Chainable<R={}> = {
  option<K extends string,V>(key:K , value: V) : Chainable<R & {[k in K]:V}>  
  get(): R
}
//将链式调用的结果储存在R中，并且作为函数返回值传递下去
```

### 联合类型遍历

ts中对union type的内部处理，是比较绕的一部分，特别是涉及到  [DistributiveConditionalTypes](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html) 。当在条件语句中传入 union type 的范形时，其结果也会是一个union type。在type-challenges 中有很多关于利用[DistributiveConditionalTypes](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)  巧妙解答的几个题目，很值得一做。

```typescript
type ToArray<Type> = Type extends any ? Type[] : never;
 
type StrArrOrNumArr = ToArray<string | number>;
// type StrArrOrNumArr = string[] | number[]
// 而不是 (string | number) []
```

如果要遍历一个union type ，实现类似js 中 foreach效果 可以通过 `K extends K` 来实现

296-Permutation

```typescript
type Permutation<T, U = T> = [T] extends [never]
  ? []
  : T extends T
  ? [T, ...Permutation<Exclude<U, T>>]
  : never;
```
这里就通过`K extends K` 实现遍历。

```typescript
 T extends T
  ? [T, ...Permutation<Exclude<U, T>>]
 // 如果 T = 1 ｜ 2 ｜ 3
 // 在条件语句后的 [T, ...Permutation<Exclude<U, T>>] 此时的T 就已经被约束到为 1 了
 // 因此Permutation<Exclude<U, T>> == Permutation<Exclude<1 ｜ 2 ｜ 3, 1>>
```

关于这道题的详细解释在 [https://github.com/type-challenges/type-challenges/issues/614](https://github.com/type-challenges/type-challenges/issues/614) 中，这个issue还解释了 never 的判断问题。

1097 - IsUnion

判断是否是联合类型也可以通过类似的方法实现，通过 `K extends K` 如果此时 K 为联合类型，条件子句中的K就会被拆分为 K 中的 一个类型，再判断此时被拆分后的 K extends T ，如果不等肯定为联合类型。

```typescript
type IsUnion<T, U = T> = T extends U
  ? [U] extends [T]
    ? false
    : true
  : never;

type IsUnion<T, U = T> = T extends T
  ? Exclude<U, T> extends never
    ? false
    : true
  : false;
```


### TS 中的递归求解

这个题库中很多题都是要用递归的方式来求解的，而既然是递归，**就需要朝着递归的目的不断逼近，即在不停的递归调用中，需要将传递的参数不断缩减，直到达到退出条件**，这个要点体现在很多题型中。

 459 - Flatten

这个题是实现一个 **Flatten **类型 ，这里两种解法都可以，关键就是考虑在递归过程中的参数变化。

```typescript
type Flatten<T extends unknown[]> = T extends [infer F, ...infer L]
  ? F extends unknown[]
    ? [...Flatten<F>, ...Flatten<L>]
    : [F, ...Flatten<L>]
  : T;

type Flatten<T extends any[],R extends any[] = []> = 
  T extends [infer F,...infer L] 
  ? F extends any[] 
    ? Flatten<[...F,...L],R> 
    : Flatten<L,[...R,F]> 
  : R
```

### 字符串匹配

ts中也可以用字符串模版进行字符串匹配，其中比较特别的情况是对 空串的匹配：

```typescript
type aa = 'test' extends `${infer F}test` ? true : false
// 这里会匹配成功 此时 F 为 "" 
```
2070 - Drop Char

```typescript
// 因为可以匹配到空串，因此可以省略对首次就能匹配上情况的处理
type DropChar<S extends string, C extends string> =
  S extends `${infer prefix}${C}${infer suffix}`
    ? DropChar<`${prefix}${suffix}`, C>
    : S;

type DropChar1<S, C extends string> = S extends `${C}${infer R}`
  ? DropChar<R, C>
  : S extends `${infer F}${infer L}`
  ? `${F}${DropChar<L, C>}`
  : S;
```

### 迭代器和延时计算


2257 - MinusOne

[原始答案](https://github.com/type-challenges/type-challenges/issues/2563)

题意是 给定一个数字N 调用` MinusOne<N>` 返回结果` N-1` 

核心思路： TS 不能操作数字进行运算，因此需要将参数N 转换为 N 长度的数组，转换后通过 
```typescript
type res<T> = T extends [infer F,...infer R] ? R['length'] : never
```
拿到 N - 1。问题在于TS对递归深度有限制，详情参考 [PR](https://github.com/microsoft/TypeScript/pull/45711) 。深度限制分为：

1. 普通递归深度限制为100层。
2. 尾递归限制为1000层。

```typescript
type ArrayOfLength<N extends number, res extends unknown[]=[]> =
  res['length'] extends N
  ? res
  : ArrayOfLength<N, [...res, unknown]>

type ok = ArrayOfLength<999>
type tooDeep = ArrayOfLength<1000>
// Type instantiation is excessively deep and possibly infinite.(2589)

```

这种方式的转换不能超过递归层数的限制，不能满足case。
```typescript
 Expect<Equal<MinusOne<1999>, 1998>>,
```
因此需要找到一种方法来绕过TS的递归层数限制，思路很简单，将**递归改成迭代，**每次展开数组时，将展开后的数组传递给下一次展开。为了实现自迭代，在范形传递时需要控制它的执行时机，不然它就还是递归。


在JS 中，为了避免参数立即执行，通常的处理方式是将要计算的参数包裹在一个函数中。

```javascript
function Defer(a){
  ....
}
Defer(1+3);
// 此时在函数执行前 a 已经被计算为 4 了
Defer(()=>1+3)
// 通过包装为函数，就能实现延时计算
```
而在TS中，也是类似的处理方式，不过是将函数换成了类型来处理。

```typescript
interface Defer<T> {
  next: T,
  value: unknown,
}

interface Result<T> extends Defer<Result<T>> {
  value: T,
}

type Next<T> = T[Extract<"next", keyof T>]


type ArrayOfLength<N extends number, Intermediate extends unknown[]=[]> = Defer<
  Intermediate['length'] extends N
  ? Result<Intermediate>
  : ArrayOfLength<N, [...Intermediate, unknown]>
>

type delay = ArrayOfLength<1000>
//type delay = Defer<ArrayOfLength<1000, [unknown]>>
type firstNext = Next<delay>
//type firstNext = Defer<ArrayOfLength<1000, [unknown, unknown]>>

```
通过这种方式我们就在TS中实现了延时计算，剩下的就是需要一种机制来不断调用`Next` 直到将N拆解完，在JS中，这一步可以用`while` 实现，但是TS中只能用手动枚举的方式来实现。

```typescript
type GetNext_10Times<T> = (
    Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T> extends infer T
  ? Next<T>
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
)
// 通过 extends infer T 可以实现类似JS迭代器中 it.next().next()的效果，让迭代器继续执行
// 同时 类似于 K extends K ，在 Next<T> extends infer T 中 后续的 Next<T> 中的T 实际上
// 就是 上一个Next<T> 展开后的结果。
// 按照这种方式扩大枚举范围 
type GetNext_100Times<T> = (
    GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T> extends infer T
  ? GetNext_10Times<T>
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
)

type GetNext_1000Times<T> = (
 ....
)
```
最后，可以得到这样的类型推断:

```typescript
type MinusOne<T extends number> = GetNext_2000Times<ArrayOfLength<T>>['value'] extends [unknown, ...infer U]
  ? U['length']
  : never;
```

其实整个流程的构造方式还挺像最近学习的 SICP 中的第三章流的结构，特别是

```typescript
type ArrayOfLength<N extends number, Intermediate extends unknown[]=[]> = Defer<
  Intermediate['length'] extends N
  ? Result<Intermediate>
  : ArrayOfLength<N, [...Intermediate, unknown]>
>

type delay = ArrayOfLength<1000>
//type delay = Defer<ArrayOfLength<1000, [unknown]>>
type firstNext = Next<delay>
//type firstNext = Defer<ArrayOfLength<1000, [unknown, unknown]>>
```
相当于是前面元素是数据，最后一个元素是生产数据的函数或者叫Prmoise更贴切一点，只有在需要的时候，即调用Next 才会生产下一个数据（**延时计算**）。


### 数组遍历

目前常见方式有两种：

1. 通过extends 遍历每个元素
2. 对象的遍历方式`keyof` 也可以用在数组上

```typescript
type List = [1,2,3,4]

type Loop<T> = T extends [infer F,...infer R] ? Loop<R> : F

type LoopObj<T> = {[K in keyof T] : T[K]}
```
### Equal

如何判断TS中两个类型是否相等，最开始我写出了

```typescript
type IsEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
// any extends anything
type test = IsEqual<any,2>
// true
```
该版本的`Equal` 类型无法判断any和其他类型，在期望中`IsEqual<any,2> === false` 。而在type-challenges 中 `Equal` 是这样实现的。

```typescript
type IsEqual<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
```
关于这个`IsEqual` 相关讨论可以参考 [链接](https://github.com/microsoft/TypeScript/issues/27024) 。

其中这个解释，说明了执行时的内部逻辑行为。

> [@jituanlin](https://github.com/jituanlin) AFAIK it relies on **conditional** types being **deferred** when T is not known. Assignability of **deferred** **conditional** types relies on an internal **isTypeIdenticalTo** check, which is only true for two **conditional** types if:
> - Both conditional types have the same constraint
> - The true and false branches of both conditions are the same type
> 
> // Two **conditional** types 'T1 extends U1 ? X1 : Y1' and 'T2 extends U2 ? X2 : Y2' are related if
// one of T1 and T2 is related to the other, U1 and U2 are identical types, X1 is related to X2,
// and Y1 is related to Y2.


```typescript
// 也就是说 （T1 extends U1 ? X1 : Y1） extends （T2 extends U2 ? X2 : Y2）? true : false
// 结果要为true 需要以下几个条件
// T1 extends T2 , U1 extends U2 , X1 extends X2 , Y1 extends Y2
type Foo<X> = <T>() => T extends X ? 1 : 2

type Bar<Y> = <T>() => T extends Y ? number : number


type Related = Foo<number> extends Bar<number> ? true : false // true

type UnRelated = Bar<number> extends Foo<number> ? true : false // false
// number extends 1 => false ; 1 extends number => true

type test = IsEqual<any,1>
// false
type anyT = (<T>() => T extends any ? 1 : 2) // 1
type numberT = (<T>() => T extends 1 ? 1 : 2) // 1 or 2
// 根据 The true and false branches of both conditions are the same type
// numbetT 的返回值是可能为1或者2 而anyT的返回值 只能为1，所以IsEqual<any,1> === false
// 修改以下条件，让numberT 返回值肯定为 1
type numberT = (<T>() => T extends 1 ? 1 : 1) // 1 
type newEqual = numberT extends anyT ? 1 : 2 //  1

```
根据这个规则，为了完成全面对比就需要将对比操作构建成以下形式，让判断规则生效。

`T1 extends U1 ? X1 : Y1） extends （T2 extends U2 ? X2 : Y2）`


### 构造元组

7544 - Construct Tuple

这道题，就是让你生成给定参数 N 长度的元组，生成元组这种要求，在前面的题中已经出现过很多次了，而这道题的难点依然在 **如何规避递归深度 ，**在迭代器和延时计算中，探讨了一种规避递归深度的例子，是通过将递归转换成迭代来实现的，而这道题使用了另一种方式：依然是递归但是通过拆解数字将递归的深度大大压缩了。

1. `ConstructTuple<1000>` 传统方式中需要迭代一千次
2. `ConstructTuple<1000>` 只需要迭代4次与给定N的字符长度正相关  

```typescript
type ConstructTuple<L extends number, Output extends string = `${L}`, Count extends unknown[] = []> =
  Output extends `${infer First}${infer Rest}` ? (
    ConstructTuple<L, Rest, N<Count>[keyof N & First]>
  ) : Count

type N<T extends unknown[] = []> = {
  '0': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T],
  '1': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown],
  '2': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown],
  '3': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown, unknown],
  '4': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown, unknown, unknown],
  '5': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown, unknown, unknown, unknown],
  '6': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown, unknown, unknown, unknown, unknown],
  '7': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown, unknown, unknown, unknown, unknown, unknown],
  '8': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown],
  '9': [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown],
}
```
### THIS

6 - Simple Vue

关于TS中的this 参考以下几篇文章：



### 逆变与协变

55 - Union to Intersection  

730 - Union to Tuple

TS是通过 `struct type` 来辨别类型的，而为了更安全的判断类型之间的关系，引入了，以下几个概念：

1.  Covariance 协变
2.  Contravariance 逆变
3.  Bivariant_ _双向协变
4.  Invariant 不变

具体的内容可以参考以下几篇文章：



简单来讲，为了保障类型使用的安全性，ts做了以下限制：

1. 函数的参数是逆变
2. 函数的返回值是协变

```typescript
interface SuperType {
    base: string;
}
interface SubType extends SuperType {
    addition: string;
};

//函数参数是逆变
type Contravariant<T> = (p: T) => void;
let contraSuperType: Contravariant<SuperType> = function(p) {}
let contraSubType: Contravariant<SubType> = function(p) {}
contraSubType = contraSuperType;
// ok 
contraSuperType = contraSubType
// error
type test = Contravariant<SuperType> extends Contravariant<SubType> ? true : false
// true 父类型 此时extends 子类型，而子类型不 extends 父类型 这种就是逆变。

//函数返回值是协变
type Cov<T> = () => T;
let contraSuperType: Cov<SuperType> = function() { return {base:'super'} }
let contraSubType: Cov<SubType> = function() { return {base:'sub',addition:'sub'} }
CovSubType = CovSuperType
// error
CovSuperType = CovSubType
// ok

type testCov = Cov<SuperType> extends Cov<SubType> ? true : false
// fale 父类型 此时 不extends 子类型，而子类型 extends 父类型 这种就是协变。

```

#### 55 - Union to Intersection  

要求是 将联合类型转换为 交叉类型

```typescript
type I = Union2Intersection<'foo' | 42 | true> // expected to be 'foo' & 42 & true
```
`&` 操作符可以视为求两个类型之间的交集，相当于是逆变，因此我们只需要构造出函数的参数形式就可以了。

```typescript
type UnionToIntersection<U> = (
  U extends any ? (arg: U) => any : never
) extends (arg: infer I) => void
  ? I
  : never;

// UnionToIntersection<'foo' | 42 | true>
// (arg: 'foo') => any | (arg: 42) => any | (arg: true) => any extends (arg: infer I) => void
// 因为函数的参数是逆变，因此 I 就是 这几个联合函数参数的交集 即 'foo' & 42 & true === never
```

#### 730 - Union to Tuple

要求是 将联合类型转换为数组

```typescript
type I = UnionToTuple<'foo' | 42 | true> // expected to be ['foo',42,true]
```
```typescript
/**
 * UnionToIntersection<{ foo: string } | { bar: string }> =
 *  { foo: string } & { bar: string }.
 */
type UnionToIntersection<U> = (
  U extends unknown ? (arg: U) => 0 : never
) extends (arg: infer I) => 0
  ? I
  : never;

/**
 * LastInUnion<1 | 2> = 2.
 */
type LastInUnion<U> = UnionToIntersection<
  U extends unknown ? (x: U) => 0 : never
> extends (x: infer L) => 0
  ? L
  : never;
// 这里的LastInUnion 通过构造出 (x:1）=>0 | (x:2)=>0 的形式传给UnionToIntersection
// UnionToIntersection 返回 (x:1)=>0 & (x:2)=>0 此时 LastInUnion被归约为
// (x:1)=>0 & (x:2)=>0 extends (x:infer L)=>0 ? L : never
// 而(x:1)=>0 & (x:2)=>0 基本等于函数重载 函数重载时会选取最后一个函数作为结果
// 即 (x:2)=>0 extends (x:infer L) => 0 ? L : never
// 因此LastInUnion<1 | 2> => 2

/**
 * UnionToTuple<1 | 2> = [1, 2].
 */
type UnionToTuple<U, Last = LastInUnion<U>> = [U] extends [never]
  ? []
  : [...UnionToTuple<Exclude<U, Last>>, Last];
```
```typescript
// 函数重载
type FunctionOverload = {
  (): number;
  (): string;
};
type A = ReturnType<FunctionOverload>;  // string

// 函数交叉类型
type Intersection = (() => number) & (() => string);
type B = ReturnType<Intersection>;  // string

// 函数重载和函数交叉类型相等
type C = FunctionOverload extends Intersection ? true : false; // true
```
