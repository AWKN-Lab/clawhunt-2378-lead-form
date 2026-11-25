#!/usr/bin/env bash
# 变异自证：证明门禁会红（技能铁律 16/17）。
# 做法：把两处关键逻辑改坏（校验位比较取反、错误码映射串位），
# 跑对应测试，必须红；再还原，跑全套测试，必须绿。
# 任何一步退出，trap 都会把源码还原，不留变异文件。
# 用法：bash scripts/mutation-check.sh（从仓库根目录运行；日志请重定向到 evidence/）。
set -euo pipefail
cd "$(dirname "$0")/.."

CREDIT_CODE_SRC="src/lib/creditCode.ts"
MOCK_API_SRC="src/lib/mockApi.ts"
BACKUP_DIR="$(mktemp -d)"
cp "$CREDIT_CODE_SRC" "$BACKUP_DIR/creditCode.ts"
cp "$MOCK_API_SRC" "$BACKUP_DIR/mockApi.ts"

restore() {
  cp "$BACKUP_DIR/creditCode.ts" "$CREDIT_CODE_SRC"
  cp "$BACKUP_DIR/mockApi.ts" "$MOCK_API_SRC"
  rm -rf "$BACKUP_DIR"
}
trap restore EXIT

fail_count=0

echo "== 变异 A：信用代码校验位比较取反（!== 改成 ===）=="
python3 - "$CREDIT_CODE_SRC" <<'EOF'
import sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text()
old = "if (expected === null || expected !== value[17]) return 'check-digit';"
new = "if (expected === null || expected === value[17]) return 'check-digit';"
assert old in t, "变异锚点不存在，停止"
p.write_text(t.replace(old, new))
print("变异已写入")
EOF
grep -n "expected === value\[17\]" "$CREDIT_CODE_SRC"
if npx vitest run src/components/LeadForm.test.tsx -t "AC3" > /tmp/mutation-a.log 2>&1; then
  echo "变异 A 未红：测试仍全过，门禁失效"
  fail_count=1
else
  echo "变异 A 变红（符合预期）："
  grep -E "Tests |×" /tmp/mutation-a.log | head -6
fi
cp "$BACKUP_DIR/creditCode.ts" "$CREDIT_CODE_SRC"
diff -q "$BACKUP_DIR/creditCode.ts" "$CREDIT_CODE_SRC" && echo "变异 A 已还原"

echo "== 变异 B：LEAD_COLLISION 映射串成 LEAD_IN_POOL 的文案 =="
python3 - "$MOCK_API_SRC" <<'EOF'
import sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text()
old = "LEAD_COLLISION: '提交失败：该线索已被其他顾问报备，请勿重复提交。',"
new = "LEAD_COLLISION: '提交失败：该企业已在公海中，请先去公海领取。',"
assert old in t, "变异锚点不存在，停止"
p.write_text(t.replace(old, new))
print("变异已写入")
EOF
grep -n "LEAD_COLLISION:" "$MOCK_API_SRC"
if npx vitest run src/components/LeadForm.test.tsx -t "AC4 LEAD_COLLISION" > /tmp/mutation-b.log 2>&1; then
  echo "变异 B 未红：测试仍全过，门禁失效"
  fail_count=1
else
  echo "变异 B 变红（符合预期）："
  grep -E "Tests |×" /tmp/mutation-b.log | head -6
fi
cp "$BACKUP_DIR/mockApi.ts" "$MOCK_API_SRC"
diff -q "$BACKUP_DIR/mockApi.ts" "$MOCK_API_SRC" && echo "变异 B 已还原"

echo "== 还原后全套测试（必须绿）=="
npx vitest run 2>&1 | grep -E "Test Files|Tests "

if [ "$fail_count" -ne 0 ]; then
  echo "变异自证失败：有变异未变红"
  exit 1
fi
echo "== 变异自证通过：两处变异均变红，还原后全绿 =="
