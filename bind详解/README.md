# 详解bind

本文主要详细分解bind函数的polyfill实现。

## 一：bind基础

bind函数的具体功能与apply，call函数相似都是改变函数体内的this对象，也就是扩充函数作用域。在<a href="https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/bind">MDN</a>中是这样介绍bind的

>bind()方法创建一个新的函数， 当这个新函数被调用时其this置为提供的值，其参数列表前几项置为创建时指定的参数序列。

由上可知，bind函数和apply，call函数不同在于<font color=#F0FFFF >bind函数执行后返回的是一个绑定了this对象的函数，而apply和call函数是直接执行</font>

下面我们来看一个简单的例子用来说明apply，call和bind的区别：
例 1：
```javaScript
var x = 'out'
var a = {
  x:'inner',
  func:function(){
    console.info('现在的所在的环境是',this.x)
  }
}

var b = a.func// inner
b.apply(a) // 现在的所在的环境是inner
b.call(a) // 现在的所在的环境是inner
b.bind(a) // 没有输出因为bind函数返回的是一个新的函数
typeof b.bind(a) === 'function' // true
b.bind(a)() // 现在的所在的环境是inner
```

因此bind函数可以异步执行，这是它区别于apply和bind的主要地方。


## 二：详解polyfill

bind方法是ECMAScript 5才加入的新方法，因此存在着浏览器兼容性问题，在具体执行中最好加入polyfill增加兼容性。在MDN的<a href="https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/bind">polyfill</a>是这样的
```
  if (!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if (typeof this !== 'function') {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function
      throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }
        var aArgs   = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP    = function() {},
        fBound  = function() {
          // this instanceof fNOP === true时,说明返回的fBound被当做new的构造函数调用
          return fToBind.apply(this instanceof fNOP
                 ? this
                 : oThis,
                 // 获取调用时(fBound)的传参.bind 返回的函数入参往往是这么传递的
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };
    // 维护原型关系
    if (this.prototype) {
      // Function.prototype doesn't have a prototype property
      fNOP.prototype = this.prototype; 
    }
    // 下行的代码使fBound.prototype是fNOP的实例,因此
    // 返回的fBound若作为new的构造函数,new生成的新对象作为this传入fBound,新对象的__proto__就是fNOP的实例
    fBound.prototype = new fNOP();
    return fBound;
  };
}
```

刚看到MDN的polyfill时，基本处于懵逼状态，后面细细琢磨才明白，要清晰bind的polyfill需要了解bind方法的操作流程，new操作符，和继承原理才行。

**主要疑惑：**
* bind方法的polyfill思路是什么
* 为什么要this为function对象
* 如何将外部的参数传入
* fNOP起到了什么作用
* 为何在fToBind.apply时要判断对bind调用是否是new操作符


### bind方法的polyfill思路

通过前面的介绍，bind方法与apply，call不同在于bind方法调用时返回的是一个新函数，而apply，call是立即执行，在不支持bind的浏览器环境下，需要用apply来模拟bind执行，核心在于bind是返回一个绑定this对象的函数，因此在polyfill中只需要返回一个函数,在返回的函数中通过apply方法绑定this对象和处理参数即可。


###this类型判断

bind方法返回的是一个绑定了this对象的函数，并且bind是Function的方法，在函数体上调用，因此要对bind调用时的this进行判断如果不是function对象则抛出错误。

```
if (typeof this !== 'function') {
      // 判断调用bind方法的是否是函数。
      throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

```

### 参数处理


在bind方法调用时需要传入两个参数，第一个是绑定的this对象，第二个是绑定的this对象的参数，因为bind方法返回一个新的函数，新的函数又可以传递参数。
所以在bind中一共有两个地方的参数需要处理，**调用bind方法时的参数，和bind方法调用返回新函数，新函数在执行时传入的参数**，这样说有点抽象，来看一个例子。

```
var price =  function (a,b){
  //price.bind(obj,10) obj的value属性值
  console.log('绑定this对象的价格是',this.value)
  //price.bind(obj,10)第二个参数的值
  console.log('调用bind方法传入的价格是',a)
  //price.bind(obj,10)(20)调用bind方法执行后函数传入的参数
  console.log('调用bind方法执行后的函数传入的价格是',b)
}
var obj = {
  value:5
}
price.bind(obj,10)(20)
//绑定this对象的价格是 5
//调用bind方法传入的价格是 10
//调用bind方法执行后的函数传入的价格是 20

```

回到具体的polyfill中，其中
>var aArgs   = Array.prototype.slice.call(arguments, 1)

这里的aArgs变量就是用来存储bind方法调用时传入的参数，其中通过Array.prototype.slice.call可以把传入的参数转化为数组，为什么要转化为数组，因为在具体调用bind时，参数个数是不确定的，在不确定参数个数时需要使用apply方法，apply方法的第二参数接受一个数组。而...slice.call(arguments, 1)，则是把bind方法调用时传入的参数从第二个开始转化为数组（因为bind方法的第一个参数是绑定的this对象）。注意这里处理的是bind(this,arguments)中的arguments，还有bind方法执行后的函数再调用时传入的参数需要处理也就是bind(this,arguments)(fArgs)中的fArgs。

在polyfill中，是这样处理fArgs的
```
fBound  = function() {
          return fToBind.apply(this instanceof fNOP
                 ? this
                 : oThis,
                 // 获取调用时(fBound)的传参.bind 返回的函数入参往往是这么传递的
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };
```

在返回函数中通过aArgs.concat(Array.prototype.slice.call(arguments)))一起把bind方法传入的参数（aArgs）和fArgs组合成为一个新的数组，作为apply方法的第二个参数。

### fNOP函数解析

在polyfill中，fNOP作用类似于寄生组合继承中的object.create()。作为一个中间函数链接返回的新函数和原函数的原型链。也就是继承原函数的方法和原型链。主要处理当返回的fBound被作为new的构造函数时原型链的继承的情况,注意当这种情况发生时bind方法传入绑定的this被忽略，参数传递不变，this使用原函数的this对象。

```
   fNOP = function() {},
        fBound  = function() {
          return fToBind.apply();
        };
    // 维护原型关系
    if (this.prototype) {
      // Function.prototype doesn't have a prototype property
      fNOP.prototype = this.prototype; 
    }
    // 下行的代码使fBound.prototype是fNOP的实例,因此
    // 返回的fBound若作为new的构造函数,new生成的新对象作为this传入fBound,新对象的__proto__就是fNOP的实例
    fBound.prototype = new fNOP();
    return fBound;
```

为何要处理new func.bind()这种情况呢？来看一下**new**操作的执行过程

>new操作符解释引用<a href="https://juejin.im/post/59bfe84351882531b730bac2">
sunshine小小倩</a>这篇文章
```
var a = new myFunction("Li","Cherry");

new myFunction{
    var obj = {};
    obj.__proto__ = myFunction.prototype;
    var result = myFunction.call(obj,"Li","Cherry");
    return typeof result === 'obj'? result : obj;
}
```

1.创建一个空对象 obj;
2.将新创建的空对象的隐式原型指向其构造函数的显示原型。
3.使用 call 改变 this 的指向
4.如果无返回值或者返回一个非对象值，则将 obj 返回作为新对象；如果返回值是一个新对象的话那么直接直接返回该对象。

可知在执行new操作时this的指向已经被改变了如果此时还是使用bind方法传入的要绑定的this，那么原函数的原型链就会被切断，导致new出来的新对象无法继承原函数的方法。所以当fToBind被当做构造函数使用时，放弃绑定传入的this对象。


##总结

由上可知，bind的polyfill主要处理了bind方法调用时参数传递问题，被当做构造函数使用时的继承问题，如果对bind执行流程和继承原理熟悉，bind的polyfill就可以一眼看穿了。









