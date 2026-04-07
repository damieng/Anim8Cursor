import { describe, it, expect } from 'vitest'
import { UndoHistory, type UndoCommand } from './undoHistory'

function makeCmd(counter: { value: number }, delta: number, name = 'test'): UndoCommand {
  return {
    name,
    execute() { counter.value += delta },
    undo() { counter.value -= delta },
  }
}

describe('UndoHistory', () => {
  it('starts empty — undo and redo return false', () => {
    const h = new UndoHistory()
    expect(h.undo()).toBe(false)
    expect(h.redo()).toBe(false)
  })

  it('push + undo restores state', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    h.push(makeCmd(c, 10))
    c.value += 10
    expect(c.value).toBe(10)
    expect(h.undo()).toBe(true)
    expect(c.value).toBe(0)
  })

  it('push + undo + redo re-applies', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    h.push(makeCmd(c, 5))
    c.value += 5
    h.undo()
    h.redo()
    expect(c.value).toBe(5)
  })

  it('multiple push + sequential undo', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    h.push(makeCmd(c, 1)); c.value += 1
    h.push(makeCmd(c, 2)); c.value += 2
    h.push(makeCmd(c, 3)); c.value += 3
    expect(c.value).toBe(6)
    h.undo()
    expect(c.value).toBe(3)
    h.undo()
    expect(c.value).toBe(1)
    h.undo()
    expect(c.value).toBe(0)
    expect(h.undo()).toBe(false)
  })

  it('push after undo clears redo stack', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    h.push(makeCmd(c, 1)); c.value += 1
    h.push(makeCmd(c, 2)); c.value += 2
    h.undo()
    expect(c.value).toBe(1)
    h.push(makeCmd(c, 10)); c.value += 10
    expect(c.value).toBe(11)
    expect(h.redo()).toBe(false)
    h.undo()
    expect(c.value).toBe(1)
  })

  it('redo without prior undo returns false', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    h.push(makeCmd(c, 1)); c.value += 1
    expect(h.redo()).toBe(false)
  })

  it('respects MAX_HISTORY (100) — oldest entry dropped', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    for (let i = 0; i < 105; i++) {
      h.push(makeCmd(c, 1)); c.value += 1
    }
    expect(c.value).toBe(105)
    let undoCount = 0
    while (h.undo()) undoCount++
    expect(undoCount).toBe(100)
    expect(c.value).toBe(5)
  })

  it('clear empties both stacks', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    h.push(makeCmd(c, 1)); c.value += 1
    h.push(makeCmd(c, 2)); c.value += 2
    h.undo()
    h.clear()
    expect(h.undo()).toBe(false)
    expect(h.redo()).toBe(false)
  })

  it('interleaved undo/redo maintains correct order', () => {
    const h = new UndoHistory()
    const c = { value: 0 }
    h.push(makeCmd(c, 1)); c.value += 1
    h.push(makeCmd(c, 2)); c.value += 2
    h.push(makeCmd(c, 4)); c.value += 4
    expect(c.value).toBe(7)
    h.undo()
    h.undo()
    expect(c.value).toBe(1)
    h.redo()
    expect(c.value).toBe(3)
    h.undo()
    h.undo()
    expect(c.value).toBe(0)
    h.redo()
    h.redo()
    h.redo()
    expect(c.value).toBe(7)
    expect(h.redo()).toBe(false)
  })
})
