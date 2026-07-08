# GitHub Pages 发布步骤

## 先确认

GitHub 免费版 Pages 更适合公开仓库。这个项目包含你的数值数据，上传后不要把链接发给别人。`robots.txt` 和 `noindex` 只是降低被搜索引擎收录的概率，不是真正的密码保护。

## 发布

1. 在 GitHub 新建一个公开仓库，名字建议用不容易猜到的，例如 `daily-data-log-2026`。
2. 把这个文件夹里的全部文件上传到仓库根目录。
3. 打开仓库的 `Settings -> Pages`。
4. `Source` 选择 `Deploy from a branch`。
5. `Branch` 选择 `main`，目录选择 `/root`，保存。
6. 等 1 到 3 分钟，页面会生成一个地址，通常是：

```text
https://你的GitHub用户名.github.io/仓库名/
```

## 放到 iPhone 主屏幕

1. 用 iPhone Safari 打开 GitHub Pages 地址。
2. 点底部分享按钮。
3. 选择“添加到主屏幕”。
4. 名称可以填“数据记录”。

## 每天更新

你每天把数值发给 Codex，例如：

```text
今天数值 1030000.00
```

Codex 会更新 `data.json`。更新后把变更提交到 GitHub，GitHub Pages 会自动刷新线上页面。
