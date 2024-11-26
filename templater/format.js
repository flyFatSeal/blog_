function formatContent(msg) {
  const content = msg;

  // 分割 YAML front matter 和正文内容
  const sections = content.split('---');
  if (sections.length >= 3) {
    const body = sections[1]; // 正文部分
    alert(body);
    // 替换正文中的换行符
    const modifiedBody = body.replace(/\n/g, '\n\n');
    alert(modifiedBody);
    // 重新组合
    const modifiedContent =
      sections[0] + '---' + modifiedBody + '---' + sections[2];
    return modifiedContent;
  }
  return msg;
}

module.exports = formatContent;
