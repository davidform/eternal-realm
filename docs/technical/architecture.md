# Technical Architecture V1

## Runtime boundaries

- React 負責外層 UI、職業選擇、角色面板、Dummy HP 與 Combat Log。
- Phaser 3 負責 60 FPS render、Arcade Physics、鍵盤輸入與 camera follow。
- `game-core` 是不依賴瀏覽器或資料庫的 deterministic domain layer；Web 場景只呼叫它，不重寫戰鬥公式。
- `game-data` 是職業與全域倍率的單一資料來源。
- Express 先提供 REST health baseline，後續 ER 工作包在這裡加入 server-authoritative endpoints。
- PostgreSQL/Prisma 保存 account 與 character 的權威資料。

## Combat calculation order

1. Accuracy / evasion 決定 Hit 或 Miss（35%～95%）。
2. 選擇 physical 或 magical attack/defense。
3. 防禦公式計算 reduction，上限 75%。
4. 套用 90%～110% random damage。
5. 獨立 critical roll 套用職業 critical damage。
6. 傷害取整且最低為 1，HP 最低為 0；0 HP 即死亡。

核心函式接受可注入的 random source，因此測試可重現完全相同的 Combat Log 數值。

## Green Meadow runtime loop

Phaser 場景以 60 FPS render，怪物 AI 與拾取檢查固定以 20 ticks/sec 更新。Normal monsters 依序使用 Idle、Chase、Attack、Return、Dead 狀態；離開 leash range 後返回出生點。玩家脫離戰鬥三秒後依 Master Spec 以每秒 2% Max HP 恢復。

擊殺六隻普通怪會解除 Goblin King 鎖定。Boss 死亡後由 `game-core` 產生 Gold、必定 Boss Treasure 和職業 First Kill weapon；玩家拾取 Boss Treasure 後才進入 Victory 狀態。
