// tests/fixtures/destructive-guard-real-wrapper.mts
// Sprint 20 C2 real-module e2e test wrapper。
// 目的:驗 shipped destructive-guard.config.ts EXPECTED_TARGET_IDENTITY = null → layer 5 fail-closed 真走。
// 手法:import module + 呼叫 requireDestructiveConfirmation()。若 layer 5 fire、guard 內 process.exit(1)、
// wrapper 永不 reach console.log。若 layer 5 miss(mutation kill guard、fail-open)、wrapper 印 WRAPPER_REACHED_END。
import { requireDestructiveConfirmation } from '../../scripts/lib/destructive-guard';
requireDestructiveConfirmation('test-real-wrapper');
console.log('WRAPPER_REACHED_END');
