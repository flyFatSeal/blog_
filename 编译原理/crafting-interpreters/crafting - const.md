

在 **_crafting_** 书中对变量声明得关键字是 **_var_** 他拥有与 **_JS_** 变量声明关键字 **_let_** 类似的性质：

1. 同一个作用域内不能重复声明
2. 不能在初始化的中引用自身

现想要增加新的关键字 **_const_** 该关键字语义参考 JS 中的 [**_const_**](https://es6.ruanyifeng.com/#docs/let#const-%E5%91%BD%E4%BB%A4)。

> const 声明一个只读的常量。一旦声明，常量的值就不能改变。



### 变量及赋值的流程

**_const_** 关键字的实现与 **_var_** 关键字 有很多类似的地方，要实现 **_const_** 关键字，首先就需要对原有 **_var_** 关键字的解析流程有基本的梳理。

![](https://cdn.jsdelivr.net/gh/flyFatSeal/cloudimg/interpret/interpret.png#crop=0&crop=0&crop=1&crop=1&height=454&id=sDfQg&originHeight=342&originWidth=377&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=&width=500)

目前，按照已有的框架，我们只关心 **_scan parse_** **_resolve interpret_** 这四个阶段，在现有解析程序中，实现变量的定义和赋值大致经过以下几个步骤：

1. 通过 **_scan_** 识别出变量定义和赋值的关键句。
2. 通过 **_parse_** 将单词符号构成语法树。
3. 通过 **_resolve_** 实现语义分析，将变量和环境（**_scopes_**）绑定。
4. 通过 **_interpret_** 调用，在对变量类 **_token_** 执行赋值行为时，如果发现未被定义则自动添加到全局环境中。

### 实现 const

根据对 **_const_** 关键词的语义规则，除了部分特性区别于 **_var_**  其余基本一致，因此在关键词和对于类生成中和 **_var_** 保持一致即可，而对于专属于 **_const_** 的特性实现需要特别说明。

#### 新增 const 关键字

修改原有 **_CFG_** 文法

```javascript
// 原版本
varDecl  → "var" IDENTIFIER ( "=" expression )? ";" ;
// 新增 
constDecl  → "const" IDENTIFIER ( "=" expression )? ";" ;
```

新增对应 **_Stm_** 类

```javascript
    "Const : Token name, Expr initializer",
```
#### 语义实现

实现该特性需要，修改原有流程：

1. 由 **_const_** 声明的变量必须要进行初始化。
2. 对 **_const_** 声明的变量再次赋值时报错。

在上述流程图中，我们将 **_resolve_** 阶段作为集中的语义分析阶段，因此对于 **_const_** 的特性也主要在 **_resolve_** 阶段实现，其余阶段按照 **_var_** 关键字的实现添加对于入口即可。

```java
 // parse
 private Stmt declaration() {
    try {
      ...
      if (match(VAR)) return varDeclaration();
      // 新增 const 语句
      if (match(CONST)) return constDeclaration();

      return statement();
    } catch (ParseError error) {
      synchronize();
      return null;
    }
  }

private Stmt constDeclaration() {
  Token name = consume(IDENTIFIER, "Expect variable name.");

  Expr initializer = null;
  if (match(EQUAL)) {
    initializer = expression();
  }

  consume(SEMICOLON, "Expect ';' after variable declaration.");
  return new Stmt.Const(name, initializer);
}
```



#####  声明语句初始化

**_const_** 声明是否初始化在 **_resolve_** 阶段判断

```java
  @Override
  public Void visitConstStmt(Stmt.Const stmt) {
    declare(stmt.name,KindType.CONST);
    if (stmt.initializer != null) {
      resolve(stmt.initializer);
    } else {
      // 未声明初始值报错
      Lox.error(stmt.name,
          "Missing initializer in const declaration.");
    }
    define(stmt.name);
    return null;
  }
```

##### 声明变量只读

在现有流程中，对再次赋值的语句都是在 **_resolve_**阶段的 `visitAssignExpr` 函数中处理，为了区分不同的变量类型以及后续的一些特俗语义判断，需要修改原有的 **_scopes_** 类型。

```java
// 原有 scopes 只需要判断标识符是否声明以及处于初始化还是未初始化的状态 因此 boolean 类型即可
private final Stack<Map<String, Boolean>> scopes = new Stack<>();
// 要新增类型来方便后续语义判断，就要修改原有类型
private final Stack<Map<String, Variable>> scopes = new Stack<>();

```

```java
  private static class Variable {
    final Token name;
    VariableState state;
    KindType kind;

    private Variable(Token name, VariableState state,KindType kind) {
      this.name = name;
      this.state = state;
      this.kind = kind;
    }
  }

  private enum VariableState {
    DECLARED,
    DEFINED,
    READ
  }

  private enum KindType {
    VAR,CONST,FUNCTION,CLASS
  }
```
通过作用域 **_scopes_** 对应标识符 的 **_kindType_** 已经 **_VariableState_** 这两个字段，就可以判断出不同的声明语句和变量类型，有了这些信息就可以实现对应的语义检查。

对 `resolveLocal` 函数重载，通过回调函数的形式实现对不同语句进行语义检查。

```java
  private void resolveLocal(Expr expr, Token name, Function<Expr, Token, Variable> assetFn) {
    for (int i = scopes.size() - 1; i >= 0; i--) {
      if (scopes.get(i).containsKey(name.lexeme)) {
        assetFn.apply(expr, name, scopes.get(i).get(name.lexeme));
        interpreter.resolve(expr, scopes.size() - 1 - i);
        return;
      }
    }
  }
```

在赋值语句函数 `visitAssignExpr` 中我们增加对 **_const_** 声明只读语义的检查

```java
  public static Boolean assetAssign(Expr expr, Token name, Variable var) {
    // 赋值语句的标识符类型为 const 并且该标识符已被声明初始化
    if (var.kind == KindType.CONST && var.state == VariableState.DEFINED ) {
      Lox.error(name,
      "Assignment to constant variable.");
    }
    return true;
  }
  @Override
  public Void visitAssignExpr(Expr.Assign expr) {
    resolve(expr.value);
    resolveLocal(expr, expr.name,Resolver::assetAssign);
    return null;
  }
```

至此，**_const_** 语义实现完毕。


### 总结

通过对 **_resolve_** 阶段的语义检查，实现了 **_const_** 语句 ，并且对 **_scopes_** 作用域变量扩展了字段，留下了空间给后续语义实现预留了接口，根据这种形式，可以有效扩展语义检查，但本人对 **_java_** 写法不熟悉，可能对最佳实现有很大的误差。
