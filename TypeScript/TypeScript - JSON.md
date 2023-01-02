
本文是对[ **_type-challenge JSON PARSE_** ](https://github.com/type-challenges/type-challenges/blob/main/questions/06228-extreme-json-parser/README.md)题目的总结，使用**_ TypeScript_** 实现一个简易的 **_JSON_** 解析器，来加深对 **_TypeScript_** 的理解。

[完整版链接](https://www.typescriptlang.org/play?#code/PQKgUABBBsBMsA4IFoICkDKB5AchACgIYBOAzgKbGQrK13UBGAnhABJMAmxA9gObkA7CAAoAAgAsmPfgEoIAYnIAPAC7FyAW3IKVmgA4AbQruQGAlruKEDCgFaluAsNXmuIARQCu5UirOPnKABNbk8AcnUIdQBHTzN1DggVbggzDUNNQRUIQiSmPXJTcgA3chs9EhUDFgqySiSU2op0bDxfYjMBXlSBZJyIbgZbcgBjbPNLazyCgDpAiAAlclj4zN7SAC5qFAgAAxxPDQZKUl2cgUTdgFUBMxHuDm0fEcICkQAdTyVvpRkzzpauAgLyEx1SvAE3ASMwgIU8EAE5HIHAEYWyfSa2hU4k0c2oAD4IAA1MzkADuAyEAHELKxPAwNhBxCoVHpNsBgCpSCNxDN7DMobxgHBEGAQMBnKAIAB9WVy+Vy2GhYgQADCD20rEo2gVutlEHFkuAECYyvOpDJJzAKny2nwnnUAB4ACqEgC8EAA3tQANr4HoQADW5FNADMIM6ALqM51+yMQZS6C6kAZDUbZAD8BAd5BdccJMbjAG4wABfEvW20QDDkFT4HgFYg2l0AGggAGkE6pBBwU-XuI2be2Q22ie6vb7-QDg2GIxAAD4d6MELtJ3sdiBZokQRn+xM9lMz7jh52biNxncIkqUEvl5w2t7O7jBoQesKesILiBhUufxdhH0-2-SMgLCDZQJbIDdgAIgAEk9dpOl4UtoLORd6zSCwzFKCsHztDoNCw0oIA9ARPAMGxFzUbwv1DawKFwqsDiOShnSrN1qEXXYAAZdk4vYAEY+KgLjYGEr9dgAZnEriABYZL2ABWBTdmgFSAHYVIQFSAE4VOQXYK3vKsiDqF1VwPCBEK6cd7SdUyKAAGQsShrBdZ9BDMAAvXNXXxH1uMjfFGMfDzbh8x1qAwFtqFPfdkwjMKfXjD1krAccMAshLdngzpQ3qAAxeJfFLXKBHylUlhK8SsyKshsni9d31A38vwA0CQLa8C2sg7YzyfF9vNzKqVDbH0Zgm502zq3wgr6xkZoa7tstQvqswc8gMDUJCqvIlRHRGwlGpTH0+qgKA8vqEaYvO26egqxKXyy9cYPg6zkNWu6IEjM7+rCoaDp8UaIHGya2wGwQ5q+xlEVKKhboW4qlrXFNdhUNC9lDDHdgEcSoHWkgKAwwi-FKXaDH2jAjuW9dTq+i7yquoGbvpy6VQhoRjr2OCEO2roUIxsiKK-ajtEXOiDAoX6fq+rMOYB66QYmmYpseyH8V+mHr3h87Efq56U2Y45iDYgo1qvOH5ogRaDb2O2uPedGJPeXHzfliLFddK3YcoagYyMvCCEJ8hnMmAxzK5jnkvHOKaZO6hXt5jp+dQr8hcopJiBo8X6PIMAZbPP1g9D1yDHJ-bY0C-EC93YPy5dYLjLeDb69jlG1YEaOSLnLm6fuwqkY5lnlbZxYgY5lNI6Sn6C9qwewtt5rzY2rA0zGeuRonjWEet+enq59rl+DgBBYgrCYDfx7C0ht91i3fagLW4ZCu0T7PwgL58PbIqgNvLKjyMLNy6208AIQMkIySdxSiDH6MdbY+lHotNsI9GaVSvvvOOHdkqz13vrA+IFzY+nLm2TeYUC6P1wb4RevVboEzqKfc+l9fBDzHqQPat8KFEmsN4Bu8DR7FG4eQNs-DSEYPbgA8hZ4NoMI-vXYoojBBjWVsQiAAiDDeChnfH2Osn43ibq-Ooq9hjry-hTCOmCAEkNMdkD0npSxwN7tQRBSNh4TVHiNW2AD87UDnngzBP4wiEJUSNSResqEHxoedOhFAjHpiYcDcuHDLw2y5rsd4PNR4GGUJkUs6S8ZSMIPEQGvgrFsIpm2LJShMjU3bn3L6o98DEN+gzB6CjOYWOntLX60TyCxJMWU-abS2yNOsUkih2jvbaz9vfYgL8g5FOoB4qeL5kpAOsd3OxLNhwsC5u9buYRAnjiWZghBqDKHAxQa09BghPHTxwSk-x4FzZcPUcNa5AgamWVOQ9NR3hhFnLaZI-GIMax1gbJQZsKjtltl+eQfEpSVAcyBZeCZO9UWXiIdYhFkY5kvJ4cc8R08jlA3gU4s5SDqCXKZswheyzBBpXuUjW2aSMlnNhbkz6USQawoRUiq2Dz25L1oUHQxa8VDxI5p8hK3z6hEhUaPOVQNkVZh9IqgZo4QmaxmfyplB9AJH3oe-T+AzimIrClK2mCr5VnLVSoZVIM1V7Q1UqrV6KKECsssTIiedhU+iQaws1L5QnavGdrOZG0S5WDLtY8x7dE7vQFmnciGdRa0Vzu6WKzLWUPS2snXg6pehZETVmG4zxXibT5rwR0uakIFqTCoAsEY5mlu5OWmtXRq223ehmqAmVUllQeotUqnpR41nuBcYd7igalnyVmHKnoh3wTHY4DgM7mXvBdvk4FaSBDwRbS8Ao7aq2HRnVq+di7PTLonWcVJG7iBbrPGk4ge7EStsPZW01+JT3Qz2PBC9V7V03swWk94WNul7FAy+st7682fu-XdRk56kbDoA2u297wGAPrnRhqDb6K2wZPQ+xDf7kNLtGCutDwGN3o3A2klQuGD34aQnBojv6F2kcveRidDG20fsI1bDAcyACieHVTiBIIQMYUJO27MrRlZlrtt2bumX24D96fEQfUxQ1TcawNKb05eHTlldiYY02k0z2nmU0aU9Zwz4bg5HvrlFLtla1kDJc3m7uuw+LyfQwOge9VJ0AunTVEVFBHMxsVvO8uw6ROMbExJqTxBHSLS-bsW+jIjMrX82g6qGnMUlO5vBGLqEa7VnXbupOSF4NZnRZl5lOXzlBauXl4FG0Ismqi8V6xw6h3pemdo+zdQvWk3IPXLL65u3dwm6jUWjWRo1ZBorUWZWZuY1zvNkL+XFYSwoKthTybNutcLordOZXBuShADKPUCoIwktVIQCgKYbu3cNGkPQUJ0RVk9BAITsRrBtiE0oAoYwIClggKGHgGhvyiDwsgHk1gsldB8MATwfhJaBMrG8F4T3u59yByD-af3PBuWEH1DajoH3enphAaChBoKMmggwaCbZmm0+Z4yXbQiIBs+giMBnINRZti522aCOIKLcBZxOGnUA6cC6Z1LtnsuOcQ9zmz0sgCec0+grcAwAv06-VLH1frUAZBtjJ7dand1dcw2Tb9EYjIfRC9V5LbnYRxcGG4GENsVuvqEEZGEBggSacMhd1LL6Gvfqh6579f334g99SN9QGQ+J4XUAJ+mR0xO3IU-fL+eFXp7Fp-T8DzP2fw65+SmEAv0di9QAz2MLP-2K-B0dABASIEC-aNTzFEvhOm8k5b2ZNEWdyDV7bKLHv8wG9E+bz-MLuYALQS1BLqXzuRcImTZ3lmgEV+e+95nP5YfudnYJHX37pfG-l-nxb86FOqe8499wO9G6BAboYBu0M8uyRQgMBwaChuJuEAZuIgfUvu507uZQnu7wxALsGGoGYE34P+xAf+we50RupuZ+ve9el+s+g+joueP2AkjOyBf+0EYO4+MyU+feZec+9+P2YuUB3A1A1ApB-+jIAksAkkYO6WbY3eaeP0YAUoL28o1sDo2I9QW05AbI12Ih0oBoEooABI1Y4mkQpoDoVk3A6ifgjgmwTILIbIGwHIXIPIfIpAAoxAQoIoCAwAhAAgFoD8EAhIJI5Imh2h-g9hjIzIrI7InI3IvI-Igowo8ANhDg7huhyhAAslCNoAlhRIIPwHod4YYcYf4WYRYbwGKBKEAA)
### 思路
题目的核心要求是实现 **_JSON_** 解析器，即输入一段**_ JSON_** 格式的文本，将其解析为正常的**_ TS _**表示的格式，并满足测试用例。

```typescript
 Expect<Equal<(
    Parse<`
      {
        "a": "b", 
        "b": false, 
        "c": [true, false, "hello", {
          "a": "b", 
          "b": false
        }], 
        "nil": null
      }
    `>
  ), (
    {
      nil: null
      c: [true, false, 'hello', {
        a: 'b'
        b: false
      }]
      b: false
      a: 'b'
    }

  )>>,
```

在解题模板中，官方已经给出了细分的实现阶段，并且由于 _TS _处理字符串转数字的形式很别扭，不考虑数字处理情况 ，降低了实现难度。

```typescript
type Pure<T> = {
  [P in keyof T]: T[P] extends object ? Pure<T[P]> : T[P]
}

type SetProperty<T, K extends PropertyKey, V> = {
  [P in (keyof T) | K]: P extends K ? V : P extends keyof T ? T[P] : never
}

type Token = any
type ParseResult<T, K extends Token[]> = [T, K]
type Tokenize<T extends string, S extends Token[] = []> = Token[]
type ParseLiteral<T extends Token[]> = ParseResult<any, T>

// 解析调用流程 
type Parse<T extends string> = Pure<ParseLiteral<Tokenize<T>>[0]>
```

在最后一行代码中，可以清晰的看到如何解析和传递**_ JSON_** 格式的字符串，有以下三个阶段：

1. **_Tokenize_** （**_ scan_** ） 扫描输入字符，进行分词。
2. **_ParseLiteral _**（ **_parse _**）解析 **_Tokenize_** 处理好的 **_token_** 序列，并获得值。
3. **_Pure_** 取出处理好的值。

整体的处理流程类似与编译原理的前端阶段，既然如此，那就按照编程语言的解析扫描过程来实现 **_TS_** 版的 **_JSON_**解析器。

### JSON 文法

按照编译语言的解析方式，可以通过 手动递归下降 方法来实现解析器，这种方式简单直观，先定义好 **_JSON_** 的上下文无关文法 （[**_CFG_**](https://zh.m.wikipedia.org/zh-hans/%E4%B8%8A%E4%B8%8B%E6%96%87%E6%97%A0%E5%85%B3%E6%96%87%E6%B3%95)）。

```typescript
json           → object | array ;
object         → "{" (member)? "}" ;
members        → pair ( "," pair )* ;
pair           → string ":" value ;
array          → "[" value ( "," value )* "]" | "[]" ;
value          → string | object | array | "true" | "false" | "null" ;
string         → """ ( character | escape )* """ ;
character      → any-Unicode-character-except-"-or-\-or-control-character ;
escape         → "\" ( "" | "\" | "/" | "b" | "f" | "n" | "r" | "t" ) ;

```

这里的文法描述只考虑 **_JSON_** 的普通使用场景，对于数字，以及一些特别编码并没有处理。通过一个简单的示例来说明文法的处理过程：

```json
{
  "name": "John Smith",
  "age": 30,
  "address": {
       "city":"New York",
       "country": "USA"
   }
}
```


![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/interpret/JSON.svg#crop=0&crop=0&crop=1&crop=1&id=KbJjo&originHeight=976&originWidth=1134&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

通过这个匹配过程，将所有的终结符，即叶子节点连接起来就是输入示例的 **_JSON _**文本。
#### 文法的处理规则

递归下降法被认为是一种自上而下的解析器，因为它从最顶层或最外层的语法规则（这里是表达式）开始，在最后到达语法树的叶子之前，一直向下进入嵌套的子表达式。这与自下而上的解析器（如 **_LR _**）形成鲜明对比，后者从主要表达式开始，将其组成越来越大的语法块。
递归下降分析器可以将语法的规则直接翻译成代码。每个规则都成为一个函数。规则的主体翻译成的代码大致为：

| **语法符号** | **代码表示** |
| --- | --- |
| 终结符 | 匹配并消费一个语法标记 |
| 非终结符 | 调用规则对应的函数 |
| &#124; | if or switch 语句 |
| * or + | while or for loop |
| ? | if 语句 |

在 **_TS_** 中可以使用递归来表示 **_while_** 和 **_for_** 循环，通过 **_extends_** 表示**_ if_** 语句。

### 解析函数

文法的执行流程和表达方式已经清楚了，剩下的就是实现各个阶段的功能，以及将文法用代码表示出来。
#### scan
扫描阶段是 **_JSON_** 解析器的第一步，**_scan_** 阶段负责将最初输入的文本，按照 **_JSON_** 文法规则分化成 **_Token_** 序列：

```typescript
 // 输入字符串 {"F": {"true": false}} 
 // 输出 Token数字序列 
 // [`{`, `"F"`, `:`, `{`, "true", `:`, `false`, `}`, `}`]
 // 将 T 作为累加器，每一个符合条件的token就塞到 T 中，并作为递归数据传递下去
 type Tokenize<S,T extends Token[]> = ... 
```

而 **_Token_** 是符合特定规则的文本信息，首先根据 **_JSON_** 文法定义什么样的字符串是 **_Token_** 类型：

```typescript
type Token =
  | '{'
  | '}'
  | '['
  | ']'
  | ':'
  | ','
  | `"${string}"`
  | null
  | true
  | false;
```

每一个符合以上类型的字符串，我们都将它划分为一个 单独的 **_token_**。

```typescript
type TokenSymbol = '{' | '}' | '[' | ']' | ':' | ','
type NumberType =
  | `0`
  | `1`
  | `2`
  | `3`
  | `4`
  | `5`
  | `6`
  | `7`
  | `8`
  | `9`
  | `-`

type Tokenize<
  S,
  T extends Token[] = []
> = S extends `${infer First}${infer Rest}`
  ? First extends TokenSymbol
    ? Tokenize<Rest, [...T, First]>
    // 从冒号开始匹配字符串直到寻找到另外一个冒号为止
    : First extends `"`
    ? ParseStringResult<Rest> extends [
        infer Rest,
        infer Token extends `"${string}"`
      ]
      ? Tokenize<Rest, [...T, Token]>
      : never
     // t,f,n 不带引号的字符串，判断是不是JSON里面的原始值 true false null
    : First extends `t` | `f` | `n`
    ? ParsePrimitiveResult<S> extends [
        infer Rest,
        infer Token extends `"${string}"` | null | true | false
      ]
      ? Tokenize<Rest, [...T, Token]>
      : never
    // 不处理数字类型 直接报错终止解析
    : First extends NumberType
    ? never
    : First extends ` ` | `\t` | `\n`
    ? Tokenize<Rest, T>
    : never
  : T;
```

而 **_ParseStringResult_** 就是将冒号包括的字符串提取处理，同时要注意内部转义字符的处理即可。

```typescript
type ParseStringResult<
  S extends string,
  Result extends string = ``
> = S extends `\\${infer First}${infer Rest}`
  ? ParseStringResult<Rest, `${Result}${EscapeCharactor<First>}`>
  : S extends `"${infer Rest}`
  ? [Rest, `"${Result}"`]
  : S extends `\n${string}`
  ? never
  : S extends `${infer First}${infer Rest}`
  ? ParseStringResult<Rest, `${Result}${First}`>
  : never;
```

至此，一个完整 **_scan_** 程序就完成了，现已经走出了一大步，实现了对输入字符的 **_token_** 划分。
#### parse
**_scan parse pure_** 三个阶段彼此相连，如同水管一般，上一个阶段的结果就是下一个阶段的输入，在 **_scan_** 阶段中，已经将原输入划分成了符合格式的句法单位，但是对如何按照文法格式将这些句法单位组成一个完整的抽象语法树，就需要在 **_parse_** 阶段中实现了。
而构成符合 **_JSON _**文法的抽象语法树比较简单，按照文法，只需要将构造对象或者数组，然后根据文法层次依次降解，最后构造出完整的 **_JSON_** 对象即可。


![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/interpret/gramJson.png.png#crop=0&crop=0&crop=1&crop=1&id=hFPWI&originHeight=492&originWidth=576&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)
##### 解析入口

```typescript
type ParseLiteral<T extends Token[]> = T extends [
  `"${string}"` | null | true | false
]
  ? [ParseLiteralResult<T[0]>]
  : ParseResult<T>;

type ParseResult<T extends Token[]> = T extends [
  infer FirstToken,
  ...infer RestTokens extends Token[]
]
  // 匹配到 '{' 就构建对象格式 匹配到 '[' 就构建数组格式
  ? FirstToken extends '{'
    ? ParseObjectResult<RestTokens>
    : FirstToken extends '['
    ? ParseArrayResult<RestTokens>
    : never
  : never;
```
##### 文法层次结构
根据上面给出的 **_JSON_** 文法，先根据文法的层次，构造出对应的处理类型

```typescript
json           → object | array ;
object         → "{" (member)? "}" ;
members        → pair ( "," pair )* ;
pair           → string ":" value ;
array          → "[" value ( "," value )* "]" | "[]" ;
value          → string | object | array | "true" | "false" | "null" ;
string         → """ ( character | escape )* """ ;
```
```typescript
// 对应文法顶层 json → object | array ;
type ParseResult<T extends Token[]> = T extends [
  infer FirstToken,
  ...infer RestTokens extends Token[]
]
  // 匹配到 '{' 就构建对象格式 匹配到 '[' 就构建数组格式
  ? FirstToken extends '{'
    ? ParseObjectResult<RestTokens>
    : FirstToken extends '['
    ? ParseArrayResult<RestTokens>
    : never
  : never;

//object  → "{" (member)? "}" ;
//members → pair ( "," pair )* ;
type ParseObjectResult<T extends Token[], Result = {}> = any
//pair → string ":" value ;
type Pair<
  Rest extends Token[],
  Result = {},
  Key extends string = ''
> = any

//array  → "[" value ( "," value )* "]" | "[]" ;
type ParseArrayResult<
  T extends Token[],
  Result extends unknown[] = []
> = any
// value  → string | object | array | "true" | "false" | "null" ;
type Value<Rest extends Token[]> = any
```

从文法看出 JSON 是存在递归嵌套的可能性，为了保证连贯性，在各自文法的处理阶段，涉及到递归的文法，例如 `_**value  → object | array; **_` 对应的 `**_type Value<Rest extends Token[]> = any_**`  都定义一个返回的数组结构 `**_[value, RestToken]_**` 该数组的第一个元素，表示取到的值，第二个元素表示剩余未处理的 **_Token_** 序列，交给下一个或者回溯的文法处理。

##### 填充处理规则
定义好了文法结构后，事情就变得简单了，只需要按照对应的文法结构填充实际匹配内容即可。

```typescript
//object  → "{" (member)? "}" ;
//members → pair ( "," pair )* ;
type ParseObjectResult<T extends Token[], Result = {}> = T extends [
  infer First,
  ...infer Rest extends Token[]
]
  // 匹配到 '}' 表面该文法匹配结束，交给下一个文法处理
  ? First extends '}'
    ? [Result, Rest]
     // members → pair ( "," pair )* ; 匹配到 ',' 进行递归处理。
    : First extends ','
    ? ParseObjectResult<Rest, Result>
     // 匹配到 string 类型，转入 pair → string ":" value ;
    : First extends `\"${infer lexeme}\"`
    ? Pair<Rest, Result, lexeme> extends [
        infer PResult,
        infer RestToken extends Token[]
      ]
      // pair → string ":" value ; 匹配完成，提取出匹配的键值对，和剩余未匹配的 
      // token 交给下一个文法处理
      ? ParseObjectResult<RestToken, PResult>
      : never
    : never
  : never;
```

```typescript
//pair → string ":" value ;
type Pair<
  Rest extends Token[],
  Result = {},
  Key extends string = ''
> = Rest extends [infer First, ...infer RestToken extends Token[]]
  ? First extends ':'
    // 转进 value  → string | object | array | "true" | "false" | "null" ;
    ? Value<RestToken> extends [infer value, infer RestToken]
      // value 文法处理完毕，将之前拿到的 string 组成一对键值对，并赋值给构建的对象
      ? [SetProperty<Result, Key, value>, RestToken]
      : never
    : never
  : [Result, Rest];
```

```typescript
//value  → string | object | array | "true" | "false" | "null" ;
type Value<Rest extends Token[]> = Rest extends [
  infer First,
  ...infer RestToken extends Token[]
]
  ? First extends `\"${infer value}\"`
    ? [value, RestToken]
    : First extends '{'
     // 当 value 为 array 和 object 时，需要将结果提取出来，不然就变成这样的嵌套结构了
     // [[result,restToken],restToken]
    ? ParseObjectResult<RestToken> extends [infer VResult, infer VRest]
      ? [VResult, VRest]
      : never
    : First extends '['
    ? ParseArrayResult<RestToken> extends [infer VResult, infer VRest]
      ? [VResult, VRest]
      : never
    : First extends Primitive
    ? [First, RestToken]
    : never
  : never;
```

这三个 **_type_** 就构成了完整的 **_JSON object_** 类型处理，能够组成完整的 **_object_** 内容并消费掉对应的 **_token_** 序列，如果存在语义错误，就返回 **_never_** 。
**_array_** 类型的处理与上面的类似，这里就不在赘述了，对于一些特定输入，例如单纯的字符串和 **_JSON _**原始值，以及转义字符，还需要添加一层特殊处理。

```typescript
type ParseLiteral<T extends Token[]> = T extends [
  `"${string}"` | null | true | false
]
  ? [ParseLiteralResult<T[0]>]
  : ParseResult<T>;

type ParseLiteralResult<T extends `"${string}"` | null | true | false> =
  T extends `"${infer StringContent}"` ? UnescapeString<StringContent> : T;

type UnescapeString<S extends string> =
  S extends `${infer First}${infer Second}${infer Rest}`
    ? `${First}${Second}` extends `\\n`
      ? `\n${UnescapeString<Rest>}`
      : `${First}${Second}` extends `\\r`
      ? `\r${UnescapeString<Rest>}`
      : `${First}${Second}` extends `\\f`
      ? `\f${UnescapeString<Rest>}`
      : `${First}${Second}` extends `\\b`
      ? `\b${UnescapeString<Rest>}`
      : `${First}${Second}` extends `\\t`
      ? `\t${UnescapeString<Rest>}`
      : `${First}${Second}${UnescapeString<Rest>}`
    : S;
```

至此，整个 **_parse_** 阶段就全部完成了，在 **_parse_** 阶段，主要是对文法结构的实际实现，以及各自文法规则的语义判断，**_parse_** 阶段完成整个解析器也就大功告成了。
### 总结
使用 **_TS _**来实现一个简易的 **_JSON_** 解析器，是对 **_TS_** 类型系统和编译原理的良好实践，在实践过程中，能够剥去 **_TS_** 身上那层迷惑的面纱，在 **递归** 代替 **循环 ** **_extends_** 代替 **_if_** ，这两个替换原则中，知道了 **_TS_** 是一门真正的编程语言，表达能力和其他语言等价，而不是简简单单的给 **_JS_** 代码标注 **_string number _**这些类型而已。
写这篇文章的原因也是在阅读 **_craftinginterpreters_** 的一次实践，强烈推荐该书，作为一本完美的编译原理启蒙书，希望每一个想了解编译原理基础的人都能看见。


### 参考文章



