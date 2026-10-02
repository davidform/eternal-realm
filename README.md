# Eternal Realm

Eternal Realm 的第一個可玩 Vertical Slice。本 repository 已建立 monorepo、React + Phaser 3 Web、Node.js API、PostgreSQL + Prisma、四職業角色、戰鬥引擎，以及可以從選角玩到擊敗 Goblin King 的 Green Meadow 關卡。

## 已完成

- **ER-001 Repository Bootstrap**：pnpm workspace、Web、API、Prisma 初始 migration、共享 TypeScript 型別
- **ER-002 Game Scene**：測試地圖、方向鍵八方向移動、camera follow、60 FPS Phaser loop
- **ER-003 Player Character**：Knight、Elf、Mage、Dark Elf 四職業及 placeholder sprite
- **ER-004 Character Stats**：STR、DEX、CON、INT、WIS、LUCK 與 HP、MP、PATK、RATK、DATK、MATK、DEF、MDEF 公式
- **ER-005 Combat Engine**：Basic Attack、命中/閃避、90%～110% 傷害浮動、防禦減傷、暴擊、死亡和 Combat Log
- **Playable Green Meadow**：Slime、Goblin、Wolf 的 Idle/Aggro/Chase/Attack/Return/Death AI
- **Progression & Loot**：EXP ×1000、升級、Gold、品質裝備、走近自動拾取、12 格本局 Loot Bag
- **Goblin King Slice**：擊殺六隻怪後喚醒 Gorvak；死亡必掉 Boss Treasure，並追加職業專屬 First Kill 武器
- **Original Art Pass**：Green Meadow 主視覺、四職業角色圖與四種敵人圖，已接入選角畫面與 Phaser 場景
- **Chapter I Narrative**：開場、動態 Chronicle、Boss 覺醒與寶藏結尾，並建立可延伸至四章的世界觀
- **Chapter I Quest**：與 Scout Lyra 對話接任務、完成獵殺目標、挑戰 Boss 並保存通關紀錄
- **Playable Loadout**：四職業主動技能、MP／冷卻、三瓶治療藥水，以及拾取後裝備武器
- **Boss Mechanics**：Gorvak Earthshake 範圍警示、可閃避傷害與半血狂暴階段
- **Game Feel Pass**：角色與怪物待機／移動／攻擊／死亡動態、戰鬥與掉寶合成音效
- **Map Collision Pass**：Moonmere Pond、倒木、岩石與營地障礙具有玩家碰撞
- **Skills & Equipment UI**：四職業各三個主動技能、獨立冷卻、單體／範圍傷害，以及可點選的武器裝備介面
- **Chapter I Quest Chain**：清除前線、收集三枚碎片、Captain Ruk 精英戰、Gorvak 營地與寶藏結尾
- **Gorvak Phase II**：半血召喚兩名護衛，並在強化地震之外追加可閃避的 Crown Charge
- **Oakvale Return Hub**：通關後返回村莊，保存英雄、最佳等級、Gold、裝備、背包與通關次數；重新整理後仍可查看並重玩第一章
- **Green Meadow Visual Pass II**：手繪草地、道路層次、環境霧氣、池塘光紋、營地魔法陣、萤火粒子與角色／怪物地面陰影
- **GitHub Pages Ready**：推送到 `main` 後自动构建网页版本，线上版使用浏览器存档，不依赖本机 API

既定規則集中在 `packages/game-data`：EXP ×1000、Rare Treasure ×100、Boss Treasure 100%。

劇情與美術規範：

- `docs/game-design/story-bible.md`
- `docs/game-design/art-direction.md`

## 專案結構

```text
apps/
  web/                  React UI + Phaser scene
  api/                  Express API + Prisma schema/migrations
packages/
  game-core/            Stats、combat、EXP、loot 純邏輯
  game-data/            職業、Dummy、全域規則資料
  shared-types/         前後端共享型別
  ui/                   React 共用 UI
assets/                 sprites、audio、maps、vfx
docs/                   game design、technical、balance
scripts/
```

## 環境需求

- Node.js 22+
- pnpm 11+
- PostgreSQL 15+（只有 migration 需要；Web 與 health check 可先獨立啟動）

## 開始開發

```bash
pnpm install
pnpm dev
```

- Web：<http://localhost:5173>
- API health check：<http://localhost:3001/health>

預設 Web 開發流程會持續重建，變更後重新整理瀏覽器即可。若環境允許 Vite 直接掃描依賴，可用 `pnpm --filter @eternal-realm/web dev:hmr` 取得 HMR。

遊戲操作：

- `↑ ↓ ← →`：移動
- `E`：與 Scout Lyra 對話並接取任務
- `Space`：攻擊範圍內最近的敵人
- `1`、`2`、`3`：施放三個職業主動技能
- `Q`：使用治療藥水
- `F`：裝備 Loot Bag 中最新的裝備
- 走過發光物：自動拾取 Gold 與裝備
- `R`：死亡或勝利後開始新一局

第一局目標：與 Lyra 對話、清除四隻前線怪物、從深處三隻怪物收集碎片、擊敗 Captain Ruk，最後進入 Gorvak's Camp 完成兩階段 Boss 戰並拾取橘色 Boss Treasure。Elf 與 Mage 攻擊距離較遠；Knight 與 Dark Elf 是近戰。

## PostgreSQL / Prisma

先將 `apps/api/.env.example` 複製為 `apps/api/.env`，並把 `DATABASE_URL` 改成可用的 PostgreSQL 連線：

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
```

初始 migration 建立 `users`、`characters`、`character_stats` 與 `CharacterClass` enum。角色的等級、EXP、Gold、HP/MP、位置和六大屬性由 server schema 保存。

## 驗證指令

```bash
pnpm typecheck
pnpm test
pnpm build
```

`game-core` 測試覆蓋四職業建立、Stage 03 範例數值、EXP/掉寶鎖定規則、完整 Green Meadow 獎勵流程，以及命中、Miss、防禦、暴擊、傷害與死亡。
