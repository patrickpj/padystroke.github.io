# 皮皮猫看着你变好

手机端计划、训练、饮食和生活记录 PWA 原型。

## 功能

- 今日任务和完成度
- 碎片化生活时间线
- 每周训练计划
- 饮食计划与实际记录
- 每日复盘和周报
- 本地保存
- Supabase 云同步

## Supabase 云数据库

推荐使用 Supabase 免费计划。

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 `supabase-schema.sql`。
3. 在项目设置里复制 `Project URL` 和 `anon public key`。
4. 打开应用的 `我的 -> 云同步 -> 设置`，填入这两个值。
5. 注册或登录后，数据会同步到云端。

如果不配置 Supabase，应用仍会使用浏览器本地保存。
