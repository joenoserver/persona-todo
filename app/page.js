"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * ステータス定義（P5 5項目 + 意志力/体力）
 */

// Persona準拠（名称）
const PERSONA_RANK_NAMES = {
  knowledge: ["平均的", "物知り", "インテリ", "博識", "知恵の泉"],
  guts: ["なくもない", "男らしい", "筋金入り", "大胆不敵", "ライオンハート"],
  proficiency: ["ぎこちない", "そこそこ", "職人級", "凄腕", "超魔術"],
  kindness: ["控え目", "聞き上手", "人情家", "駆け込み寺", "慈母神"],
  charm: ["人並み", "気になる存在", "注目株", "カリスマ", "魔性の男"],
};

// Persona準拠（ランク開始点 min）
const PERSONA_THRESHOLDS_MIN = {
  knowledge: [0, 34, 82, 126, 192],
  guts: [0, 11, 38, 68, 113],
  proficiency: [0, 12, 34, 60, 87],
  kindness: [0, 14, 44, 91, 136],
  charm: [0, 6, 52, 92, 132],
};

// 追加2項目（仮）
const EXTRA_RANK_NAMES = {
  willpower: ["気まぐれ", "持ち直し", "継続", "不屈", "鋼の意志"],
  stamina: ["ひょろい", "一般人", "鍛え始め", "アスリート", "鉄人"],
};
const EXTRA_THRESHOLDS_MIN = {
  willpower: [0, 10, 25, 45, 70],
  stamina: [0, 10, 25, 45, 70],
};

const STATUS_ORDER = [
  { id: "knowledge", label: "知識" },
  { id: "guts", label: "度胸" },
  { id: "proficiency", label: "器用さ" },
  { id: "kindness", label: "優しさ" },
  { id: "charm", label: "魅力" },
  { id: "willpower", label: "意志力" },
  { id: "stamina", label: "体力" },
];

// ランク選択肢（1〜5）
const RANK_OPTIONS = [
  { value: 1, label: "ランク1以上" },
  { value: 2, label: "ランク2以上" },
  { value: 3, label: "ランク3以上" },
  { value: 4, label: "ランク4以上" },
  { value: 5, label: "ランク5以上" },
];

const STATUS_LABEL = Object.fromEntries(STATUS_ORDER.map((s) => [s.id, s.label]));

const STORAGE_KEY = "persona_todo_v1";

function getRankInfo(statusId, value) {
  const v = Math.max(0, Number(value) || 0);

  if (PERSONA_THRESHOLDS_MIN[statusId]) {
    const mins = PERSONA_THRESHOLDS_MIN[statusId];
    const names = PERSONA_RANK_NAMES[statusId];
    let rank = 0;
    for (let i = 0; i < mins.length; i++) if (v >= mins[i]) rank = i;
    const nextMin = rank < 4 ? mins[rank + 1] : null;
    const currentMin = mins[rank];
    return { rankNumber: rank + 1, rankLabel: names[rank], currentMin, nextMin };
  }

  if (EXTRA_THRESHOLDS_MIN[statusId]) {
    const mins = EXTRA_THRESHOLDS_MIN[statusId];
    const names = EXTRA_RANK_NAMES[statusId];
    let rank = 0;
    for (let i = 0; i < mins.length; i++) if (v >= mins[i]) rank = i;
    const nextMin = rank < 4 ? mins[rank + 1] : null;
    const currentMin = mins[rank];
    return { rankNumber: rank + 1, rankLabel: names[rank], currentMin, nextMin };
  }

  return { rankNumber: 1, rankLabel: "—", currentMin: 0, nextMin: null };
}

/**
 * レーダーチャート用：0..1 に正規化
 * - ランク(1..5)の中での進捗も使って「じわっと伸びる」見た目にする
 */
function getNormalizedProgress(statusId, value) {
  const v = Math.max(0, Number(value) || 0);
  const info = getRankInfo(statusId, v);
  const rankIdx = info.rankNumber - 1; // 0..4
  if (info.nextMin === null) return 1; // MAX

  const denom = Math.max(1, info.nextMin - info.currentMin);
  const inRank = Math.min(1, Math.max(0, (v - info.currentMin) / denom)); // 0..1
  // 0..1 = (rankの開始位置) + (rank内進捗) / 5ランク
  const normalized = (rankIdx + inRank) / 4; // 0..1 （0〜4を4で割る）
  return Math.min(1, Math.max(0, normalized));
}

function RadarChart({ values }) {
  // values: [{ id,label, normalized(0..1), value, rankLabel, rankNumber }]
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = 120;

  const count = values.length;
  const startAngle = -Math.PI / 2; // 上から開始

  function pointAt(i, r01) {
    const angle = startAngle + (Math.PI * 2 * i) / count;
    const rr = R * r01;
    return { x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) };
  }

  // 外枠（7角形）
  const outer = values
    .map((_, i) => {
      const p = pointAt(i, 1);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  // データポリゴン
  const poly = values
    .map((v, i) => {
      const p = pointAt(i, v.normalized);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  // 目盛り（リング） 20%,40%,60%,80%,100%
  const rings = [0.2, 0.4, 0.6, 0.8, 1].map((r) =>
    values
      .map((_, i) => {
        const p = pointAt(i, r);
        return `${p.x},${p.y}`;
      })
      .join(" ")
  );

  // 軸線
  const axes = values.map((_, i) => {
    const p = pointAt(i, 1);
    return { x: p.x, y: p.y };
  });

  // ラベル
  const labels = values.map((v, i) => {
    const p = pointAt(i, 1.15); // 少し外側
    return { ...v, x: p.x, y: p.y };
  });

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 12,
        display: "inline-block",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>七角形ステータス</div>
      <svg width={size} height={size}>
        {/* リング */}
        {rings.map((pts, idx) => (
          <polygon
            key={idx}
            points={pts}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth="1"
          />
        ))}

        {/* 軸線 */}
        {axes.map((p, idx) => (
          <line
            key={idx}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#e5e5e5"
            strokeWidth="1"
          />
        ))}

        {/* 外枠 */}
        <polygon points={outer} fill="none" stroke="#cfcfcf" strokeWidth="2" />

        {/* データ */}
        <polygon points={poly} fill="rgba(0,0,0,0.08)" stroke="#111" strokeWidth="2" />

        {/* 中心点 */}
        <circle cx={cx} cy={cy} r="2" fill="#111" />

        {/* ラベル */}
        {labels.map((l, idx) => (
          <g key={idx}>
            <text
              x={l.x}
              y={l.y}
              fontSize="12"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#111"
            >
              {l.label}
            </text>
          </g>
        ))}
      </svg>

      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>
        ※ランク内の進捗も反映して、じわっと伸びる表示にしてある
      </div>
    </div>
  );
}

/**
 * タスク：effects に「各ステータスへ ±」を持つ
 * 変更点：done はやめて、何回でも実行できるように count を持つ
 */
const INITIAL_TASKS = [
  { id: "t1", title: "悪口を言った", effects: { kindness: -1 }, count: 0 },
  { id: "t2", title: "筋トレをした", effects: { stamina: +1, willpower: +1 }, count: 0,
  successCount: 0 },
];

// 解放条件（アンロック）例
const INITIAL_UNLOCKS = [
  {
    id: "u1",
    title: "女の子と話せる",
    statusId: "guts",
    needRank: 4, // 大胆不敵以上
  },
];


function multiplyEffects(effects, mul) {
  const out = {};
  for (const [k, vRaw] of Object.entries(effects || {})) {
    const v = Number(vRaw) || 0;
    if (v !== 0) out[k] = v * mul;
  }
  return out;
}

function emptyEffects() {
  const e = {};
  for (const s of STATUS_ORDER) e[s.id] = 0;
  return e;
}

export default function Home() {
  // ステータスの現在値（累積ポイント）
  const [stats, setStats] = useState(() => {
    const init = {};
    for (const s of STATUS_ORDER) init[s.id] = 0;
    return init;
  });

  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const [loaded, setLoaded] = useState(false);

  // 解放条件（アンロック）
  const [unlocks, setUnlocks] = useState(INITIAL_UNLOCKS);

  // アンロック追加フォーム
  const [newUnlockTitle, setNewUnlockTitle] = useState("");
  const [newUnlockStatusId, setNewUnlockStatusId] = useState("guts");
  const [newUnlockNeedRank, setNewUnlockNeedRank] = useState(4);

  // 新規タスク追加（7項目フル）
  const [newTitle, setNewTitle] = useState("");
  const [newEffects, setNewEffects] = useState(() => emptyEffects());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoaded(true);
        return;
      }
      const data = JSON.parse(raw);

      // 形チェック（最低限）
      if (data?.stats) setStats(data.stats);
      if (Array.isArray(data?.tasks)) setTasks(data.tasks);
      if (Array.isArray(data?.unlocks)) setUnlocks(data.unlocks);

      setLoaded(true);
    } catch (e) {
      console.error("Failed to load:", e);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return; // 初回ロードが終わるまで保存しない

    try {
      const data = { stats, tasks, unlocks };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, [stats, tasks, unlocks, loaded]);

  const statusCards = useMemo(() => {
    return STATUS_ORDER.map((s) => {
      const value = stats[s.id] ?? 0;
      const info = getRankInfo(s.id, value);
      const normalized = getNormalizedProgress(s.id, value);
      return { ...s, value, normalized, ...info };
    });
  }, [stats]);

  const radarValues = useMemo(
    () =>
      statusCards.map((s) => ({
        id: s.id,
        label: s.label,
        normalized: s.normalized,
        value: s.value,
        rankLabel: s.rankLabel,
        rankNumber: s.rankNumber,
      })),
    [statusCards]
  );

  function isUnlocked(u) {
    const value = stats[u.statusId] ?? 0;
    const info = getRankInfo(u.statusId, value);
    return info.rankNumber >= Number(u.needRank);
  }

    function addUnlock() {
      const title = newUnlockTitle.trim();
      if (!title) return;

      const u = {
        id: `u_${Date.now()}`,
        title,
        statusId: newUnlockStatusId,
        needRank: Number(newUnlockNeedRank) || 1,
      };

      setUnlocks((prev) => [u, ...prev]);
      setNewUnlockTitle("");
      setNewUnlockStatusId("guts");
      setNewUnlockNeedRank(4);
    }

    function removeUnlock(id) {
      setUnlocks((prev) => prev.filter((u) => u.id !== id));
    }

  function applyTask(taskId, effects, mul = 1) {
  // 回数カウント（何回でもOK）
  setTasks((prev) =>
    prev.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        count: (t.count || 0) + 1,
        successCount: (t.successCount || 0) + (mul === 2 ? 1 : 0),
      };
    })
  );

  // ステータス反映（倍率をかける）
  const applied = mul === 1 ? effects : multiplyEffects(effects, mul);

  setStats((prev) => {
    const next = { ...prev };
    for (const [statusId, deltaRaw] of Object.entries(applied || {})) {
      const delta = Number(deltaRaw) || 0;
      if (delta === 0) continue;
      const cur = next[statusId] ?? 0;
      next[statusId] = Math.max(0, cur + delta);
    }
    return next;
  });
}


  function addTask() {
    const title = newTitle.trim();
    if (!title) return;

    const effects = {};
    for (const s of STATUS_ORDER) {
      const v = Number(newEffects[s.id]) || 0;
      if (v !== 0) effects[s.id] = v;
    }

    const task = {
      id: `t_${Date.now()}`,
      title,
      effects,
      count: 0,
      successCount: 0,
    };

    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    setNewEffects(emptyEffects());
  }

  function resetAll() {
    setStats(() => {
      const init = {};
      for (const s of STATUS_ORDER) init[s.id] = 0;
      return init;
    });
    setTasks((prev) => prev.map((t) => ({ ...t, count: 0 })));
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1>能力値Todo（プロトタイプ）</h1>

      {/* 上：チャート + ステータス */}
      <section style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <RadarChart values={radarValues} />

        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0 }}>ステータス</h2>
            <button
              onClick={resetAll}
              style={{
                marginLeft: "auto",
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                cursor: "pointer",
              }}
            >
              全リセット
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginTop: 10,
            }}
          >
            {statusCards.map((s) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{s.label}</strong>
                  <span>Pt: {s.value}</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  ランク{s.rankNumber}：<strong>{s.rankLabel}</strong>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  {s.nextMin === null
                    ? "MAX"
                    : `次まで：${Math.max(0, s.nextMin - s.value)}（次の開始点: ${s.nextMin}）`}
                </div>

                {/* 進捗バー（見た目で伸びる） */}
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 8,
                      background: "#f0f0f0",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.round(s.normalized * 100)}%`,
                        background: "#111",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                    全体進捗 {Math.round(s.normalized * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 解放条件（アンロック） */}
            <section style={{ marginTop: 22 }}>
              <h2>解放条件（アンロック）</h2>

              {/* 追加フォーム */}
              <div style={{ display: "grid", gap: 10, maxWidth: 840 }}>
                <input
                  value={newUnlockTitle}
                  onChange={(e) => setNewUnlockTitle(e.target.value)}
                  placeholder="例：女の子と話せる / バイトに応募できる"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ fontSize: 12 }}>
                    条件ステータス
                    <select
                      value={newUnlockStatusId}
                      onChange={(e) => setNewUnlockStatusId(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ fontSize: 12 }}>
                    必要ランク
                    <select
                      value={newUnlockNeedRank}
                      onChange={(e) => setNewUnlockNeedRank(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {RANK_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  onClick={addUnlock}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  解放条件を追加
                </button>
              </div>

              {/* 一覧 */}
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {unlocks.length === 0 ? (
                  <div style={{ opacity: 0.7, fontSize: 13 }}>まだ解放条件がありません</div>
                ) : (
                  unlocks.map((u) => {
                    const ok = isUnlocked(u);
                    const statusLabel = STATUS_LABEL[u.statusId] ?? u.statusId;

                    return (
                      <div
                        key={u.id}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: 12,
                          padding: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: ok ? "rgba(0,0,0,0.06)" : "transparent",
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>
                          {ok ? "✅ 解放" : "🔒 未達"}
                        </span>

                        <span style={{ fontWeight: 700 }}>{u.title}</span>

                        <small style={{ opacity: 0.8 }}>
                          （条件：{statusLabel} ランク{u.needRank}以上）
                        </small>

                        <button
                          onClick={() => removeUnlock(u.id)}
                          style={{
                            marginLeft: "auto",
                            padding: "6px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            cursor: "pointer",
                          }}
                        >
                          削除
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

      {/* タスク追加（7項目フル対応） */}
      <section style={{ marginTop: 22 }}>
        <h2>タスク追加（7項目フル）</h2>

        <div style={{ display: "grid", gap: 10, maxWidth: 840 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="例：悪口を言わなかった / 10分散歩した"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8,
            }}
          >
            {STATUS_ORDER.map((s) => (
              <label key={s.id} style={{ fontSize: 12 }}>
                {s.label} ±
                <input
                  type="number"
                  value={newEffects[s.id]}
                  onChange={(e) =>
                    setNewEffects((prev) => ({ ...prev, [s.id]: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                  }}
                />
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={addTask}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              追加
            </button>

            <button
              onClick={() => {
                setNewTitle("");
                setNewEffects(emptyEffects());
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                cursor: "pointer",
              }}
            >
              入力クリア
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            ※ここで設定した ± が「実行」ボタンを押すたびに毎回反映される（何回でも）
          </div>
        </div>
      </section>

      {/* タスクリスト（何回でも実行できる） */}
      <section style={{ marginTop: 22 }}>
        <h2>タスク</h2>

        <ul style={{ paddingLeft: 18 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700 }}>{t.title}</span>

                <small style={{ opacity: 0.85 }}>
                  {Object.keys(t.effects).length === 0
                    ? "（効果なし）"
                    : "（" +
                      Object.entries(t.effects)
                        .map(([k, v]) => `${STATUS_LABEL[k] ?? k}:${v > 0 ? "+" : ""}${v}`)
                        .join(", ") +
                      "）"}
                </small>

                <small style={{ opacity: 0.7 }}>実行回数：{t.count || 0}</small>
                <small style={{ opacity: 0.7 }}>大成功：{t.successCount || 0}</small>

                <button
                  onClick={() => applyTask(t.id, t.effects, 2)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  大成功（×2）
                </button>

                <button
                  onClick={() => applyTask(t.id, t.effects, 1)}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  実行
                </button>

              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
