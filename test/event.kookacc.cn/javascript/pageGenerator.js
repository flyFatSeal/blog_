let params_use = {};

const formatUrl = fixUrl(window.location.search);

const urlParams = parseUrlParams(formatUrl);

function parseUrlParams(url) {
  const regex = /[?&]([^=#]+)=([^&#]*)/g;
  const params = {};
  let match;
  while ((match = regex.exec(url))) {
    const key = decodeURIComponent(match[1]);
    const value = decodeURIComponent(match[2]);
    params[key] = value;
  }
  return params;
}

async function getSetting() {
  const params = getParams(formatUrl);
  const {
    pages = [],
    group_title = '与伴同游，终不止戏',
    sales_id,
    game_id,
    page_group_id,
  } = await getSettingByParams(params);

  params_use = {
    sales_id,
    game_id,
    page_group_id,
    nick_name: hexToStr(params?.nick_name),
    version: params.version_id,
    sum_version: params.sum_version,
  };
  console.info(params_use);
  generateSlide(pages);
  initBasicInfo(group_title);
  initLogin();
  iniSwiper();
  initVerify();
  checkLuckyStatus(pages);
}

getSetting();

function generateSlide(pages = []) {
  window.showLogin = {};

  const slideContent = document.getElementsByClassName('swiper-wrapper')[0];

  let slideStr = '';
  let slideMedia = '';
  pages.forEach((page, index) => {
    const {controls, images} = page;
    slideStr += `
        <div class="swiper-slide"  id="slide-${index}" >
            ${generateControls(controls, index)}
        </div>
       `;
    slideMedia += generateStyle(images, index);
  });

  var style = document.createElement('style');
  // 创建 CSS 规则
  var cssRule = document.createTextNode(slideMedia);
  style.appendChild(cssRule);
  document.head.appendChild(style);

  slideContent.innerHTML = slideStr;
}

function generateStyle(images, id) {
  let mediaStyle = '';
  Object.keys(images).forEach((size) => {
    if (images[size]) {
      const query = `(max-width: ${Number(size)}px)`;
      const style = `
          #slide-${id} {
            background: url(${images[size]}) top center no-repeat;
            background-size:cover
          }
        `;
      mediaStyle += ` ${style} `;
    }
  });
  return mediaStyle;
}

function generateControls(controls = [], pageIndex = '') {
  let controlsHtml = '';

  controls &&
    controls.forEach((control) => {
      controlsHtml += generateControlBtn({...control, pageIndex});
    });

  return controlsHtml;
}

function generateControlBtn(setting = {}) {
  const {images, control_type, pushid, control_extra = {}, pageIndex} = setting;
  const url = control_extra && control_extra[`${control_type}_url`];
  const recharge_image = control_extra && control_extra['recharge_image'];
  if (control_type === 'login') {
    window.showLogin[pageIndex] = true;
    return '';
  }
  if (!images) return '';

  calcImgSize(
    `${control_type}_${pushid || pageIndex}`,
    recharge_image || images
  );

  const controlBtn = `<div class="control ${control_type}-btn" id="${control_type}_${
    pushid || pageIndex
  }" style="background-image:url(${
    recharge_image || images
  })" onclick="controlService('${encodeURI(
    JSON.stringify({type: control_type, pushid: pushid})
  )}')" >
                            <a type=${control_type}" href="${
    url ? url : 'javascript:'
  }"  ${url ? 'target = "_blank"' : ''}></a>
                        </div>`;
  return controlBtn;
}

function calcImgSize(id, image) {
  var img = new Image();
  img.src = image;

  img.onload = function () {
    var width = img.width;
    var height = img.height;
    $(`#${id}`).height(height / 2);
    $(`#${id}`).width(width);
  };
}

function controlService(params = {}) {
  const data = JSON.parse(decodeURI(params));
  const {type, pushid} = data;
  const uid = localStorage.getItem('uid');
  if (type == 'floating') {
    return;
  }

  if (type === 'lucky') {
    getLucky(pushid);
  }
}

async function openPrizeList() {
  const tableContent =
    '<div class="modal_default"><table class="layui-hide table_default" id="prize_table"></table></div>';
  const prizeList = await getPrizeList();
  if (!prizeList) {
    return;
  }
  openModal({
    type: 1,
    area: ['700px', '450px'],
    content: tableContent,
    index: 20,
    success: () => {
      layui.use('table', async function () {
        var table = layui.table;
        var inst = table.render({
          elem: '#prize_table',
          cols: [
            [
              //标题栏
              {field: 'getTime', title: '时间', width: 150, unresize: true},
              {
                field: 'product_name',
                title: '奖品',
                minWidth: 200,
                unresize: true,
              },
              {
                title: '操作',
                width: 160,
                templet: '#ID-table-demo-templet-edit',
                unresize: true,
              },
            ],
          ],
          data: prizeList,
          page: true, // 是否显示分页
          limits: [5],
          limit: 5, // 每页默认显示的数量
        });

        table.on('tool(prize_table)', function (obj) {
          var data = obj.data; // 获得当前行数据
          if (obj.event === 'edit') {
            const infoForm = createForm(data.id);
            layer.open({
              index: 25,
              title: '填写信息',
              type: 1,
              area: ['400px', '450px'],
              content: `<div style="padding: 16px;"  >${infoForm}</div>`,
            });
          }
          if (obj.event === 'show') {
            const infoForm = createInfo(data.record_extra);
            layer.open({
              title: '查看信息',
              type: 1,
              area: ['400px', '300px'],
              content: `<div style="padding: 16px;"  >${infoForm}</div>`,
            });
          }
          if (obj.event === 'copy') {
            copyContent(data.operate.detail);
            layer.msg('CDK已复制');
          }
          if (obj.event === 'cash') {
            getCashCode();
          }
        });
      });
    },
  });
}

async function copyContent(text) {
  try {
    window.mbQuery && window.mbQuery(8, text);
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
}

function createForm(id) {
  const infoForm = `
    <form class="layui-form"  lay-filter="val-filter" >
    <div class="demo-reg-container">
    <div class="layui-form-item">
        <div class="layui-row">
        <div class="layui-col-xs7">
            <div class="layui-input-wrap">
            <div class="layui-input-prefix">
                <i class="layui-icon layui-icon-cellphone"></i>
            </div>
            <input type="text" name="phone" value="" lay-verify="required|phone"  placeholder="手机号" lay-reqtext="请填写手机号" autocomplete="off" class="layui-input" id="reg-phone">
            </div>
        </div>
        <div class="layui-col-xs5">
            <div style="margin-left: 11px;">
                <button type="button" class="layui-btn layui-btn-fluid layui-btn-primary" lay-on="reg-get-vercode" id="getvercode">获取验证码</button>
            </div>
        </div>
        </div>
    </div>
    <input type="text" name="id" value="" id="reg-id" style="display: none;">
    <div class="layui-form-item">
        <div class="layui-input-wrap">
        <div class="layui-input-prefix">
            <i class="layui-icon layui-icon-vercode"></i>
        </div>
        <input type="text" name="vercode" value="" lay-verify="required"  placeholder="验证码" lay-reqtext="请填写验证码" autocomplete="off" class="layui-input">
        </div>
    </div>
    <div class="layui-form-item">
        <div class="layui-input-wrap">
        <div class="layui-input-prefix">
            <i class="layui-icon layui-icon-username"></i>
        </div>
        <input type="text" name="name" value="" lay-verify="required"  placeholder="姓名" autocomplete="off" class="layui-input" id="reg-name">
        </div>
    </div>
    <div class="layui-form-item">
        <div class="layui-input-wrap">
            <div class="layui-input-prefix">
             <i class="layui-icon layui-icon-login-qq"></i>
            </div>
            <input type="text" name="qq" value="" lay-verify="required"  placeholder="QQ" lay-reqtext="请填写QQ" autocomplete="off" class="layui-input">
        </div>
   </div>

    <div class="layui-form-item">
        <div class="layui-input-wrap">
        <div class="layui-input-prefix">
            <i class="layui-icon layui-icon-location"></i>
        </div>
        <input type="text" name="address" value="" lay-verify="required"  placeholder="地址" autocomplete="off" class="layui-input" id="reg-address" >
        </div>
    </div>
    <div class="layui-form-item">
        <span class="layui-btn layui-btn-fluid" lay-submit lay-filter="submit" id="submit">提交</span>
    </div>
    </div>
</form>
`;
  var form = layui.form;
  var layer = layui.layer;
  var util = layui.util;

  util.on('lay-on', {
    // 获取验证码
    'reg-get-vercode': function (othis) {
      var isvalid = form.validate('#reg-phone'); // 主动触发验证，v2.7.0 新增
      // 验证通过
      if (isvalid) {
        const {phone} = form.val('val-filter');
        _captchaObj.succfun = () => {
          verifyCallback(phone);
        };
        _captchaObj.verify();
      }
    },
  });

  form.verify({
    // 函数写法
    // 参数 value 为表单的值；参数 item 为表单的 DOM 对象
    phone: function (value, item) {
      //再这里初始化赋值
      form.val('val-filter', {id});
      if (value.length > 20) {
        return '输入合法手机号';
      }
    },
    // 数组写法。
    // 数组中两个成员值分别代表：[正则表达式、正则匹配不符时的提示文字]
    address: [/^\s*$/, '地址不能为空'],
  });

  // 提交事件
  form.on('submit(submit)', function (data) {
    var field = data.field; // 获取表单字段值
    updatePrize({
      record_id: Number(field.id),
      verify_code: field.vercode,
      record_extra: {
        phone: field.phone,
        qq: field.qq,
        address: field.address,
        name: field.name,
      },
    }).then((res) => {
      if (res.code !== 0) {
        layer.msg(res.message || '更新信息失败');
        return;
      }
      layer.closeAll();
      setTimeout(() => {
        openPrizeList();
      }, 500);
    });
    return false; // 阻止默认 form 跳转
  });

  return infoForm;
}

function createInfo(data) {
  const infoContent = `
    <div>
        <div>
            <span>姓名：</span>
            <span>${data.name}</span>
        </div>
        <div>
            <span>手机号：</span>
            <span>${data.phone}</span>
        </div>
        <div>
            <span>QQ：</span>
            <span>${data.qq}</span>
        </div>
        <div>
            <span>地址：</span>
            <span>${data.address}</span>
        </div>
    </div>
`;
  return infoContent;
}

function openModal(setting = {isError: false}) {
  const {
    type,
    area = ['350px', '242px'],
    title = '',
    shade = 0.6, // 遮罩透明度
    shadeClose = true, // 点击遮罩区域，关闭弹层
    anim = 0, // 0-6 的动画形式，-1 不开启
    content = `<div class="modal_default" >
                        <div class="${
                          setting.isError ? 'error_default' : 'success_default'
                        }"></div>
                        ${setting?.message || '遇到未知错误，请重试'}
                  </div>
                  `,
    btn = [],
    closeBtn = 1,
  } = setting;

  layer.open({
    ...setting,
    type,
    area,
    title,
    shade,
    shadeClose,
    anim,
    content,
    btn,
  });
}

function initBasicInfo(title) {
  document.title = title;
}

function iniSwiper() {
  let exposure = {};
  var swiper = new Swiper('.swiper-container', {
    direction: 'vertical',
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
      type: 'custom',
      hashNavigation: true,
    },
    observer: true,
    observerParents: true,
    threshold: 30,
    preventInteractionOnTransition: true,
    on: {
      slideChange: function () {
        const loginContent =
          document.getElementsByClassName('user loginlink')[0];
        if (window.showLogin[this.activeIndex]) {
          loginContent.style.display = 'block';
        } else {
          loginContent.style.display = 'none';
        }

        var currentPage = swiper.realIndex + 1;
        window.currentPage = currentPage;

        if (!exposure[currentPage]) {
          track &&
            track.track_event('template_act_page_exposure', {
              brand: config.BRAND_INFO,
              x_page: window.currentPage,
              x_source: params_use.page_group_id,
              x_feature: '',
              x_content: '',
              x_action: '',
            });
        }

        exposure[currentPage] = true;
      },
      init: function () {
        const loginContent =
          document.getElementsByClassName('user loginlink')[0];
        if (window.showLogin[0]) {
          loginContent.style.display = 'block';
        } else {
          loginContent.style.display = 'none';
        }
        exposure[1] = true;
        window.currentPage = 1;
      },
    },
    mousewheel: true,
  });
}

async function initVerify() {
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/user-personal-center/auth/start-captcha?brand=${config.VITE_BRAND}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    if (response.ok) {
      const data = await response.json();
      initGeetest(
        {
          gt: data.data.gt,
          challenge: data.data.challenge,
          new_captcha: data.data.new_captcha,
          product: 'bind',
          offline: !data.data.success,
        },
        function (captchaObj) {
          window._captchaObj = captchaObj;
          window._captchaObj.onSuccess(function () {
            if (!window._captchaObj.getValidate()) return alert('请完成验证');
            window._captchaObj.succfun();
          });
        }
      );
    } else {
      throw new Error('Network response was not ok.');
    }
  } catch (error) {
    console.error(error);
  }
}

function initLogin() {
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const dom = $('#user-login');
  track && track.login(`${userInfo.user_id || 0}`);

  if (config.BRAND_INFO === 'kook') {
    track._set_public_properties({brand: 'kook'});
  }

  if (urlParams.action == '99') {
    const nick_nameFromClient = hexToStr(urlParams.nickname);
    getExchangeToken(urlParams.token).then((res) => {
      sessionStorage.setItem('token', res.token);
      let user = res;
      if (nick_nameFromClient) {
        user.nick_name = nick_nameFromClient;
      }
      sessionStorage.setItem('user', JSON.stringify(user));

      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res));

      window.location.href = `${window.location.origin}${
        window.location.pathname
      }?group_id=${urlParams.group_id}&${queryStringify({
        ...params_use,
        sales_id: urlParams.sales_id,
      })}`;
    });
  }

  track &&
    track.track_event('template_act_page_exposure', {
      brand: config.BRAND_INFO,
      x_page: '1',
      x_source: params_use.page_group_id,
      x_feature: '',
      x_content: '',
      x_action: '',
    });

  if (userInfo.login_id) {
    let showName = getShowName(config.BRAND_INFO, userInfo);

    dom.html(`<span class="s">您好 ${showName}， <a  class="login logout - handler" title="退出" onclick="onLogin()">[退出]</a></span>
                 <span class="prizes - wrapper"  onclick="openPrizeList()" >[奖品记录]</span>`);

    track &&
      track.track_event('template_act_login_success', {
        brand: config.BRAND_INFO,
        x_page: window.currentPage || '1',
        x_source: params_use.page_group_id,
        x_feature: '',
        x_content: '',
        x_action: '',
      });
  } else {
    dom.html(`<span onclick="onLogin()">您好，请 登录</span>`);
  }

  if (config.BRAND_INFO === 'kook') {
    window.parent.postMessage(
      urlParams,
      '*' // 使用 '*' 表示允许发送到任何源，或指定主页面的 URL 更安全
    );

    window.addEventListener('message', (event) => {
      // 验证消息来源的安全性
      if (event?.origin !== window.location.origin) return;
      if (event.data.token) {
        if (event.data.version_id) {
          return;
        }
        sessionStorage.setItem('token', event.data.token);
        sessionStorage.setItem('user', JSON.stringify(event.data));

        localStorage.setItem('token', event.data.token);
        localStorage.setItem('user', JSON.stringify(event.data));

        window.location.reload();
      }
    });
  }
}

async function verifyCallback(phone) {
  const data = {
    login_id: phone,
    tmpl_id: config.VITE_TEPL_ID,
    user_type: 'sj',
    brand: config.VITE_BRAND,
    area: '86',
  };
  //极验证提交信息
  if (_captchaObj) {
    var result = _captchaObj.getValidate();
    data['geetest_challenge'] = result?.geetest_challenge;
    data['geetest_validate'] = result?.geetest_validate;
    data['geetest_seccode'] = result?.geetest_seccode;
  }
  startCountdown();
  const response = await fetch(
    `${config.VITE_API_URL}/api/user-personal-center/auth/sendcode`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );
  if (response.ok) {
    const res = await response.json();
    if (res.code !== 0) {
      openModal({isError: true, message: res.message});
    }
  } else {
    throw new Error('Network response was not ok.');
  }
}

function startCountdown() {
  var count = 60;
  $('#getvercode').addClass('layui-btn-disabled');
  $('#getvercode').prop('disabled', true);
  var interval = setInterval(function () {
    if (count <= 0) {
      clearInterval(interval);
      $('#getvercode').removeClass('layui-btn-disabled');
      $('#getvercode').text('获取验证码');
      $('#getvercode').prop('disabled', false);
      return;
    }
    $('#getvercode').text('重新发送(' + count + ')');
    count--;
  }, 1000);
}

function getParams(url) {
  const queryString = url;
  const params = {};

  if (queryString) {
    queryString
      .substring(1)
      .split('&')
      .forEach((pair) => {
        const [key, value] = pair.split('=');
        if (
          key === 'group_id' ||
          key === 'is_preview' ||
          key === 'sales_id' ||
          key === 'game_id'
        ) {
          params[key] = Number(decodeURIComponent(value));
        } else {
          params[key] = decodeURIComponent(value);
        }
      });
  }
  return params;
}

async function getSettingByParams(params) {
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/activity-marketing/page-group/get-info`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );
    if (response.ok) {
      const res = await response.json();
      if (res.code !== 0) {
        openModal({
          isError: true,
          message: res.message || '该活动暂不支持',
        });
        return {};
      }
      config.BRAND_INFO = res.data.brand;
      return res.data;
    } else {
      throw new Error('Network response was not ok.');
    }
  } catch (error) {
    console.error(error);
  }
}

function getQueryParam(param) {
  const queryString = formatUrl;
  const searchParams = new URLSearchParams(queryString);
  return searchParams.get(param);
}

async function getLucky(pushid) {
  var loading = layer.load(2);
  track &&
    track.track_event('template_act_btn_click', {
      brand: config.BRAND_INFO,
      x_page: window.currentPage,
      x_source: params_use.page_group_id,
      x_feature: '',
      x_content: '',
      x_action: '',
    });
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/activity-marketing/activity-push/lucky`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          pushid,
        }),
      }
    );
    if (response.ok) {
      const res = await response.json();

      if (res.code !== 0 && !res?.data?.product_ids) {
        if (res.code === 401001) {
          return onLogin();
        }
        track &&
          track.track_event('template_act_lottery_success_fail', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: '',
            x_content: res.message,
            x_action: '',
          });

        return openModal({isError: true, message: res.message});
      }

      if (res.code === 400005 && res?.data?.product_ids) {
        const products = await getProductList(
          {product_ids: res?.data?.product_ids},
          pushid
        );
        track &&
          track.track_event('template_act_btn_click', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: 'topup',
            x_content: '',
            x_action: '',
          });
        return window.openChargeModal(products);
      }

      $(`#lucky_${pushid}`).css(
        'background-image',
        `url(${luckyStatus[pushid]['recharge_image']})`
      );

      const {
        category_tag,
        detail_val,
        product_name,
        inbound_main_name,
        prize_text,
      } = res.data.list[0];

      if (category_tag === 'propcard') {
        track &&
          track.track_event('template_act_lottery_success', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: `${inbound_main_name}:${detail_val}`,
            x_content: '',
            x_action: '',
          });
        return openModal({
          message: `恭喜获得 <span style="color:#00ff84">${inbound_main_name}</span>: ${detail_val}`,
        });
      }
      if (category_tag === 'recharge') {
        track &&
          track.track_event('template_act_lottery_success', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: inbound_main_name,
            x_content: '',
            x_action: '',
          });
        return openModal({
          message: `恭喜获得<span style="color:#00ff84">${inbound_main_name}</span>`,
        });
      }
      if (category_tag === 'propmerproduct') {
        track &&
          track.track_event('template_act_lottery_success', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: inbound_main_name,
            x_content: '',
            x_action: '',
          });
        return openModal({
          message: `恭喜获得<span style="color:#00ff84">${inbound_main_name}</span>`,
        });
      }
      if (category_tag === 'propentity') {
        track &&
          track.track_event('template_act_lottery_success', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: product_name,
            x_content: '',
            x_action: '',
          });
        return openModal({
          message: `恭喜获得<span style="color:#00ff84">${product_name}</span>请前往奖品记录中填写个人信息`,
        });
      }
      if (category_tag === 'propcash') {
        track &&
          track.track_event('template_act_lottery_success', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: inbound_main_name,
            x_content: '',
            x_action: '',
          });
        return openModal({
          message: `恭喜获得<span style="color:#00ff84">${inbound_main_name}</span>请前往【奖品记录】中提取`,
        });
      }

      if (category_tag === 'stock-losing-lottery') {
        track &&
          track.track_event('template_act_lottery_success', {
            brand: config.BRAND_INFO,
            x_page: window.currentPage,
            x_source: params_use.page_group_id,
            x_feature: product_name,
            x_content: '',
            x_action: '',
          });
        return openModal({
          message: `<span style="color:#00ff84">${prize_text}</span>`,
        });
      }
    } else {
      throw new Error('Network response was not ok.');
    }
  } catch (error) {
    track &&
      track.track_event('template_act_lottery_success_fail', {
        brand: config.BRAND_INFO,
        x_page: window.currentPage,
        x_source: params_use.page_group_id,
        x_feature: '',
        x_content: error.message,
        x_action: '',
      });
    console.info(error);
  } finally {
    layer.close(loading);
  }
}

async function getPrizeList() {
  var loading = layer.load(2);
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/activity-marketing/user-record/get-prize-list`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(getParams(formatUrl)),
      }
    );
    if (response.ok) {
      const res = await response.json();
      if (res.code === 401001) {
        return onLogin();
      }
      return res?.data?.list?.map((col) => {
        let product_name = '';
        let record_extra = null;
        let operate = {};
        if (col.category_tag === 'stock-losing-lottery') {
          product_name = col.prize_text;
          operate = {
            type: 'text',
            content: '',
          };
        }
        if (col.category_tag === 'propcard') {
          product_name = `${col.inbound_main_name}: ${col.detail_val}`;
          operate = {
            type: 'copy',
            content: '复制',
            detail: col.detail_val,
          };
        }
        if (col.category_tag === 'propentity' && !record_extra?.phone) {
          product_name = col.inbound_main_name;
          record_extra = col.record_extra;
          operate = {
            type: 'edit',
            content: '填写信息',
          };
        }
        if (col.category_tag === 'propentity' && record_extra?.phone) {
          product_name = col.inbound_main_name;
          record_extra = col.record_extra;
          operate = {
            type: 'show',
            content: '查看信息',
          };
        }
        if (col.category_tag === 'propcash') {
          product_name = col.inbound_main_name;
          record_extra = col.record_extra;
          operate = {
            type: 'cash',
            content: '扫码提现',
          };
        }
        if (
          col.category_tag === 'recharge' ||
          col.category_tag === 'propmerproduct'
        ) {
          product_name = col.inbound_main_name;
          operate = {
            type: 'text',
            content: '已发放',
          };
        }

        return {
          product_name,
          getTime: col.lottery_time,
          operate,
          id: col.record_id,
          record_extra,
        };
      });
    } else {
      throw new Error('Network response was not ok.');
    }
  } catch (error) {
    console.info(error);
    onLogin();
    return null;
  } finally {
    layer.close(loading);
  }
}

async function updatePrize(params) {
  var loading = layer.load(2);
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/activity-marketing/user-record/update-prize-info`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(params),
      }
    );
    if (response.ok) {
      const res = await response.json();
      return res;
    } else {
      layer.msg('更新信息失败');
    }
  } catch (error) {
    layer.msg('更新信息失败');
  } finally {
    layer.close(loading);
  }
}

async function getProductList(params, pushid) {
  var loading;
  const pms = getParams(formatUrl);
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/activity-marketing/product/get-list`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({...params, pushid}),
      }
    );
    if (response.ok) {
      const res = await response.json();
      const recharge = res?.data?.recharge.filter((option) => {
        return !!option.price && Object.keys(option.price).length;
      });
      loading = layer.load(2);
      const result = await Promise.all(
        recharge.map(async (option) => {
          try {
            const username = connectUserName(
              JSON.parse(localStorage.getItem('user'))
            );
            const {
              discount_type,
              currency,
              price_label,
              product_price,
              price_id,
              discount_label,
            } =
              Object.keys(option.price).map((currency) => {
                return {
                  discount_type: option.price[currency].discount_type,
                  currency: option.price[currency].currency,
                  price_label: option.price[currency].price_label,
                  product_price: option.price[currency].product_price,
                  price_id: option.price[currency].price_id,
                  discount_label: option.price[currency].discount_label,
                };
              })[0] || {};

            const {game_id, sales_id} = getParams(formatUrl);

            let ext = {
              pushid,
              entry_tag: 'actbox',
            };
            if (params_use.nick_name) {
              ext.nick_name = params_use.nick_name;
            }
            return {
              title: option.product_name,
              headDes: price_label,
              discount: discount_label,
              pmoney: product_price,
              id: price_id,
              qrParma: {
                ...option,
                account_no: username,
                login_id: username,
                ext_params: JSON.stringify(ext),
                game_id: params_use.game_id || game_id,
                sales_id:
                  params_use.sales_id === null ? sales_id : params_use.sales_id,
                pushid,
                version: params_use.version,
                sum_version: params_use.sum_version,
              },
            };
          } catch (e) {
            console.info(e);
            return {
              title: '',
              id: '',
            };
          }
        })
      );

      return result;
    }
  } catch (error) {
    layer.msg('获取信息失败');
  } finally {
    loading && layer.close(loading);
  }
}

function getCashCode() {
  var token,
    username,
    base = new Base64(),
    load = layer.load(1),
    amount = 0;
  $.ajax({
    url: `${config.VITE_API_URL}/api/activity-marketing/prize-token/sign/create`,
    type: 'post',
    dataType: 'json',
    crossDomain: true,
    beforeSend: function (request) {
      request.setRequestHeader(
        'Authorization',
        `Bearer ${localStorage.getItem('token')}`
      );
    },
    xhrFields: {
      withCredentials: true,
    },
    success: (data) => {
      layer.close(load);

      if (data.code == 0) {
        sign = data.data.sign;
        user_id = data.data.user_id;
        timestamp = data.data.timestamp;
        username = data.username;
        amount = data.data.cash_amount;
        if (amount === 0) {
          layer.alert('中奖金额已全部提现');
          return;
        }
        var mainUrl = '//tg.xunyou.com/index.php/native/qrcode/';
        var weixinUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${config.VITE_CASH_APPID}&redirect_uri=${config.VITE_CASH_REDIRECT}&response_type=code&scope=snsapi_base&state=`;

        let codeurl = '';

        if (config.BRAND_INFO === 'xy') {
          codeurl =
            mainUrl +
            base.encode(
              weixinUrl +
                user_id +
                '_' +
                timestamp +
                '_' +
                sign +
                `_${config.BRAND_INFO}&scene=0#wechat_redirect`
            ) +
            '/m/185';
        }

        if (config.BRAND_INFO === 'guguai') {
          const state = JSON.stringify({
            sign,
            timestamp,
            user_id,
          });

          codeurl = `${mainUrl}${base.encode(
            `${weixinUrl}${state}&scene=0#wechat_redirect`
          )}/m/185`;
        }

        layer.open({
          type: 1,
          title: false,
          content:
            "<div class='qrcode-cash'>" +
            '<div >' +
            "<img class='qrcode-cash-img' src=" +
            codeurl +
            '/>' +
            "<span class='qrcode-logo'></span>" +
            '</div>' +
            '</div>',
        });
      } else if (data.id == -2) {
        onLogin();
      } else {
        layer.msg(data.msg);
      }
    },
    error: function (error) {
      console.log('error', error);
    },
  });
}

function checkLuckyStatus(pages) {
  window.luckyStatus = {};
  for (const page of pages) {
    if (page.controls) {
      page.controls.map((control) => {
        if (control.control_type === 'lucky') {
          luckyStatus[control.pushid] = {
            recharge_image: control?.control_extra?.recharge_image,
            images: control?.images,
          };
        }
      });
    }
  }

  Object.keys(luckyStatus).map(async (pushid, index) => {
    try {
      const response = await getLuckyStatus({pushid: Number(pushid)});
      if (response.code === 0) {
        if (response.data.count > 0) {
          $(`#lucky_${pushid}`).css(
            'background-image',
            `url(${luckyStatus[pushid]['images']})`
          );
          calcImgSize(`lucky_${pushid}`, luckyStatus[pushid]['images']);
        }
      }
    } catch (e) {
      console.info('status:error', error);
    }
  });
}

async function getExchangeToken(token) {
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/user-personal-center/auth/exchange-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({token}),
      }
    );
    if (response.ok) {
      const res = await response.json();
      return res.data;
    }
  } catch (error) {}
}

async function getLuckyStatus(params) {
  try {
    const response = await fetch(
      `${config.VITE_API_URL}/api/activity-marketing/user-record/get-lucky-count`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(params),
      }
    );
    if (response.ok) {
      const res = await response.json();
      return res;
    }
  } catch (error) {}
}

const connectUserName = (userInfo) => {
  const {user_type, login_id} = userInfo;
  if (login_id.indexOf(user_type + '.') == 0) return login_id;
  return userInfo?.login_id
    ? userInfo.user_type != 'zf'
      ? userInfo.user_type + '.' + userInfo.login_id
      : userInfo.login_id
    : '';
};

const onLogin = () => {
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  if (userInfo.login_id) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    location.reload();
    return;
  }
  if (config.BRAND_INFO === 'kook') {
    layer.open({
      type: 2,
      title: false,
      shadeClose: true,
      closeBtn: 1,
      area: ['800px', '650px'],
      content: `${getDomainAddress('ms', {
        env: 'test2',
      })}/api/user-auth/oauth/v2/login?spid=0000&sales_id=111&client_mac=123123&router_mac=123123&client_ver=7&channel_no=kook_nooff&brand=kook&action=login&pub_tag=web&redirect_uri=${
        window.location.href
      }&redirect=1`,
    });

    return;
  }
  Login({
    isFullScreen: 1,
    hasCloseButton: false,
    brand: config.VITE_BRAND,
    isThird: true,
  });
};

function hexToStr(hex) {
  if (!hex) return null;
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }

  const uint8Array = new Uint8Array(bytes);
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(uint8Array);
}

function getShowName(brand, userInfo) {
  let res = connectUserName(userInfo);

  if (brand === 'kook') {
    const nick_name = userInfo.nick_name || userInfo.nickname;

    res =
      urlParams.nickname && !nick_name
        ? hexToStr(urlParams.nickname)
        : decodeBase64(nick_name);
  }

  return res;
}

function decodeBase64(base64Str) {
  // 将 Base64 编码的字符串解码成原始字节字符串

  const decodedStr = isBase64(base64Str) ? atob(base64Str) : base64Str;

  // 使用 escape 对字符进行编码，生成百分号编码的字符串
  const percentEncodedStr = decodedStr
    .split('')
    .map((char) => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`)
    .join('');

  // 使用 decodeURIComponent 解码成正常的中文字符
  return decodeURIComponent(percentEncodedStr);
}

function isBase64(str) {
  const base64Regex =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  return base64Regex.test(str);
}

function hexToStr(hex) {
  if (!hex) return null;
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }

  const uint8Array = new Uint8Array(bytes);
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(uint8Array);
}

function fixUrl(url) {
  const index = url.indexOf('?', 1); // 查找第二个 ? 的位置
  if (index !== -1) {
    // 将第二个 ? 替换为 &
    return url.slice(0, index) + '&' + url.slice(index + 1);
  }
  return url; // 如果没有第二个 ?，返回原始 URL
}

function queryStringify(params) {
  return Object.keys(params)
    .map((key) => {
      if (Array.isArray(params[key])) {
        let qs = '';
        params[key].forEach((element) => {
          qs += `${encodeURIComponent(key)}=${encodeURIComponent(element)}&`;
        });

        return qs.slice(0, -1);
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
    })
    .join('&');
}
