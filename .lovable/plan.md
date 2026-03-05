

# Plan: Show Variable Picker Only on Focus

## Change

In `src/components/shared/VariableTextInput.tsx`, add a `focused` state. The variable list panel (the `w-52` div) will only render when the input/textarea is focused. Add `onFocus` and `onBlur` handlers to the input/textarea to toggle this state. Use a small delay on `onBlur` (150ms) so clicking a variable doesn't dismiss the panel before the click registers.

## File Changed

| File | Change |
|------|--------|
| `src/components/shared/VariableTextInput.tsx` | Add `focused` state, `onFocus`/`onBlur` handlers with 150ms delay, conditionally render variable panel |

