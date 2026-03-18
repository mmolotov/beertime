import { createWidget, deleteWidget, widget, align, text_style, prop, show_level, event, anim_status } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { Time, Step } from '@zos/sensor'
import { launchApp, SYSTEM_APP_STATUS } from '@zos/router'

// Change this value to tune how many steps are needed for one full mug cycle.
const DEFAULT_STEPS_PER_MUG = 3000
const FULL_AT_RATIO = 0.9
const MAX_VISIBLE_MUGS = 8
const MINI_COLUMNS = 2
const STEP_THRESHOLD_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  steps: (index + 1) * 1000,
  preview: `edit_steps_${(index + 1) * 1000}.png`,
  path: `edit_bg_steps_${(index + 1) * 1000}.png`,
  title: `${(index + 1) * 1000} steps`,
}))

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const BLANK_IMG_SRC = 'blank.png'

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function mugIndex(fillRatio) {
  const ratio = Math.max(0, Math.min(1, fillRatio))
  return Math.max(0, Math.min(10, Math.floor(ratio * 10 + 0.0001)))
}

function mugSrc(fillRatio) {
  return 'mug_' + String(mugIndex(fillRatio)).padStart(2, '0') + '.png'
}

function mugAnimPath(fillRatio) {
  return 'mug_anim_' + String(mugIndex(fillRatio)).padStart(2, '0')
}

function getCurrentSteps(stepSensor) {
  if (!stepSensor) {
    return 0
  }

  if (typeof stepSensor.getStepCount === 'function') {
    return stepSensor.getStepCount() || 0
  }

  if (typeof stepSensor.getCurrent === 'function') {
    return stepSensor.getCurrent() || 0
  }

  if (typeof stepSensor.current === 'number') {
    return stepSensor.current
  }

  return 0
}

function getLayout(width, height) {
  const isTall = height > width
  const miniW = Math.round(width * (isTall ? 0.062 : 0.07))
  const miniH = Math.round(miniW * 1.1)
  const miniGap = Math.round(width * 0.016)

  return {
    time: {
      x: 0,
      y: Math.round(height * 0.038),
      w: width,
      h: Math.round(height * 0.15),
      size: Math.round(height * 0.145),
    },
    date: {
      x: 0,
      y: Math.round(height * 0.162),
      w: width,
      h: Math.round(height * 0.065),
      size: Math.round(height * 0.052),
    },
    steps: {
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.81),
      w: Math.round(width * 0.84),
      h: Math.round(height * 0.07),
      size: Math.round(height * 0.055),
    },
    progress: {
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.865),
      w: Math.round(width * 0.84),
      h: Math.round(height * 0.045),
      size: Math.round(height * 0.034),
    },
    mugOffsetY: Math.round(height * 0.05),
    mini: {
      x: Math.round(width * 0.06),
      y: Math.round(height * 0.28),
      iconW: miniW,
      iconH: miniH,
      gap: miniGap,
      overflowX: Math.round(width * 0.06) + miniW + miniGap,
      overflowY: Math.round(height * 0.28) + 4 * (miniH + miniGap) + Math.round(height * 0.01),
      overflowW: miniW,
      overflowH: Math.round(height * 0.05),
      overflowSize: Math.round(height * 0.042),
    },
  }
}

function createStepThresholdEditor(width, height) {
  if (!createWidget || !widget || !prop) {
    return null
  }

  try {
    return createWidget(widget.WATCHFACE_EDIT_BG, {
      edit_id: 1,
      x: 0,
      y: 0,
      bg_config: STEP_THRESHOLD_OPTIONS.map((option) => ({
        id: option.id,
        path: option.path,
        preview: option.preview,
      })),
      count: STEP_THRESHOLD_OPTIONS.length,
      default_id: STEP_THRESHOLD_OPTIONS.find((option) => option.steps === DEFAULT_STEPS_PER_MUG).id,
      fg: 'edit_mask_100.png',
      tips_x: Math.round(width * 0.28),
      tips_y: Math.round(height * 0.81),
      tips_bg: 'blank.png',
      show_level: show_level.ONLY_NORMAL | show_level.ONLY_EDIT,
    })
  } catch (error) {
    console.log('step editor unavailable', error)
    return null
  }
}

function getEditorSelection(editBgWidget) {
  if (!editBgWidget) {
    return null
  }

  try {
    const currentType = editBgWidget.getProperty(prop.CURRENT_TYPE)
    if (typeof currentType === 'number' && currentType > 0) {
      return currentType
    }
  } catch (_) {}

  try {
    const currentSelect = editBgWidget.getProperty(prop.CURRENT_SELECT)
    if (typeof currentSelect === 'number' && currentSelect > 0) {
      return currentSelect
    }
  } catch (_) {}

  try {
    const selectIndex = editBgWidget.getProperty(prop.SELECT_INDEX)
    if (typeof selectIndex === 'number' && selectIndex >= 0) {
      const option = STEP_THRESHOLD_OPTIONS[selectIndex]
      return option ? option.id : null
    }
  } catch (_) {}

  return null
}

function getSelectedStepsPerMug(editBgWidget) {
  const currentSelection = getEditorSelection(editBgWidget)
  const currentOption = STEP_THRESHOLD_OPTIONS.find((option) => option.id === currentSelection)
  return currentOption ? currentOption.steps : DEFAULT_STEPS_PER_MUG
}

function getCurrentEditType(editBgWidget) {
  return getEditorSelection(editBgWidget) || 0
}

function getProgressState(totalSteps, stepsPerMug) {
  const safeSteps = Math.max(0, totalSteps || 0)
  const fullAtSteps = Math.round(stepsPerMug * FULL_AT_RATIO)
  const completedMugs = Math.floor(safeSteps / stepsPerMug)
  const cycleSteps = safeSteps % stepsPerMug
  const isFullBeforePour = cycleSteps >= fullAtSteps
  const fillRatio = isFullBeforePour
    ? 1
    : cycleSteps / fullAtSteps

  return {
    totalSteps: safeSteps,
    completedMugs,
    cycleSteps,
    fillRatio,
    fullAtSteps,
    isFullBeforePour,
    stepsToNextPour: Math.max(stepsPerMug - cycleSteps, 0),
  }
}

function openTodaySteps() {
  try {
    launchApp({
      appId: SYSTEM_APP_STATUS,
      native: true,
    })
    console.log('steps app opened')
  } catch (error) {
    console.log('steps app unavailable', error)
  }
}

WatchFace({
  build() {
    const { width, height } = getDeviceInfo()
    const layout = getLayout(width, height)
    const editBgWidget = createStepThresholdEditor(width, height)

    const time = new Time()
    const step = new Step()

    createWidget(widget.IMG, {
      x: 0,
      y: 0,
      src: 'bg.png',
      show_level: show_level.ONLY_NORMAL,
    })

    const mugWidget = createWidget(widget.IMG, {
      x: 0,
      y: layout.mugOffsetY,
      src: 'mug_00.png',
      show_level: show_level.ONLY_NORMAL,
    })

    let mugAnimWidget = null
    let activeMugAnimIndex = -1

    createWidget(widget.IMG, {
      x: 0,
      y: 0,
      src: 'header_overlay.png',
      show_level: show_level.ONLY_NORMAL,
    })

    const timeWidget = createWidget(widget.TEXT, {
      x: layout.time.x,
      y: layout.time.y,
      w: layout.time.w,
      h: layout.time.h,
      text: '--:--',
      color: 0xF5E7C8,
      text_size: layout.time.size,
      text_style: text_style.NONE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      show_level: show_level.ONLY_NORMAL,
    })

    const dateWidget = createWidget(widget.TEXT, {
      x: layout.date.x,
      y: layout.date.y,
      w: layout.date.w,
      h: layout.date.h,
      text: '',
      color: 0xD8B676,
      text_size: layout.date.size,
      text_style: text_style.NONE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      show_level: show_level.ONLY_NORMAL,
    })

    const stepsWidget = createWidget(widget.TEXT, {
      x: layout.steps.x,
      y: layout.steps.y,
      w: layout.steps.w,
      h: layout.steps.h,
      text: '',
      color: 0xFFF7E1,
      text_size: layout.steps.size,
      text_style: text_style.NONE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      show_level: show_level.ONLY_NORMAL,
    })

    const progressWidget = createWidget(widget.TEXT, {
      x: layout.progress.x,
      y: layout.progress.y,
      w: layout.progress.w,
      h: layout.progress.h,
      text: '',
      color: 0xD7A24A,
      text_size: layout.progress.size,
      text_style: text_style.NONE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      show_level: show_level.ONLY_NORMAL,
    })

    const miniWidgets = []
    const mini = layout.mini
    for (let i = 0; i < MAX_VISIBLE_MUGS; i++) {
      miniWidgets.push(createWidget(widget.IMG, {
        x: mini.x,
        y: mini.y,
        src: 'mug_mini.png',
        show_level: show_level.ONLY_NORMAL,
      }))
    }

    const miniOverflowWidget = createWidget(widget.TEXT, {
      x: mini.overflowX,
      y: mini.overflowY,
      w: mini.overflowW,
      h: mini.overflowH,
      text: '',
      color: 0xD8B676,
      text_size: mini.overflowSize,
      text_style: text_style.NONE,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      show_level: show_level.ONLY_NORMAL,
    })

    function handleStepsTap() {
      console.log('steps widget tapped')
      openTodaySteps()
    }

    stepsWidget.setEnable(true)
    progressWidget.setEnable(true)
    stepsWidget.addEventListener(event.CLICK_UP, handleStepsTap)
    progressWidget.addEventListener(event.CLICK_UP, handleStepsTap)

    function updateTime() {
      const now = new Date()
      timeWidget.setProperty(prop.MORE, {
        text: pad2(now.getHours()) + ':' + pad2(now.getMinutes()),
      })
    }

    function updateDate() {
      const now = new Date()
      dateWidget.setProperty(prop.MORE, {
        text: WEEK_DAYS[now.getDay()] + ' ' + pad2(now.getDate()) + ' ' + MONTHS[now.getMonth()],
      })
    }

    function updateStepWidgets() {
      const stepsPerMug = getSelectedStepsPerMug(editBgWidget)
      const state = getProgressState(getCurrentSteps(step), stepsPerMug)
      stepsWidget.setProperty(prop.MORE, {
        text: state.totalSteps + ' steps',
      })

      progressWidget.setProperty(prop.MORE, {
        text: state.isFullBeforePour
          ? 'Full mug  next in ' + state.stepsToNextPour
          : state.cycleSteps + ' / ' + stepsPerMug + '  next in ' + state.stepsToNextPour,
      })
    }

    function updateMiniMugs(completedMugs) {
      const visibleCount = Math.min(completedMugs, MAX_VISIBLE_MUGS)
      const hiddenCount = Math.max(0, completedMugs - MAX_VISIBLE_MUGS)

      for (let i = 0; i < MAX_VISIBLE_MUGS; i++) {
        const column = i % MINI_COLUMNS
        const row = Math.floor(i / MINI_COLUMNS)
        miniWidgets[i].setProperty(prop.MORE, {
          x: i < visibleCount ? mini.x + column * (mini.iconW + mini.gap) : -mini.iconW,
          y: i < visibleCount ? mini.y + row * (mini.iconH + mini.gap) : -mini.iconH,
          src: i < visibleCount ? 'mug_mini.png' : BLANK_IMG_SRC,
        })
      }

      miniOverflowWidget.setProperty(prop.MORE, {
        text: hiddenCount > 0 ? '+' + hiddenCount : '',
      })
    }

    function startMugAnimation() {
      if (!mugAnimWidget) {
        return
      }

      try {
        mugAnimWidget.setProperty(prop.ANIM_STATUS, anim_status.START)
      } catch (_) {}
    }

    function recreateMugAnimation(fillRatio) {
      const nextIndex = mugIndex(fillRatio)
      if (nextIndex === activeMugAnimIndex && mugAnimWidget) {
        startMugAnimation()
        return
      }

      if (mugAnimWidget) {
        try {
          deleteWidget(mugAnimWidget)
        } catch (_) {}
        mugAnimWidget = null
      }

      activeMugAnimIndex = nextIndex

      try {
        mugAnimWidget = createWidget(widget.IMG_ANIM, {
          x: 0,
          y: layout.mugOffsetY,
          anim_path: mugAnimPath(fillRatio),
          anim_prefix: 'frame',
          anim_ext: 'png',
          anim_fps: 3,
          anim_size: 3,
          repeat_count: 1,
          anim_status: anim_status.START,
          show_level: show_level.ONLY_NORMAL,
          anim_complete_call: () => {
            startMugAnimation()
          },
        })
      } catch (error) {
        console.log('mug animation unavailable', error)
        mugAnimWidget = null
      }
    }

    function updateMug() {
      const stepsPerMug = getSelectedStepsPerMug(editBgWidget)
      const state = getProgressState(getCurrentSteps(step), stepsPerMug)
      mugWidget.setProperty(prop.MORE, {
        src: mugSrc(state.fillRatio),
      })
      recreateMugAnimation(state.fillRatio)
      updateMiniMugs(state.completedMugs)
      updateStepWidgets()
    }

    function updateAll() {
      updateTime()
      updateDate()
      updateMug()
    }

    updateAll()

    time.onPerMinute(() => {
      updateTime()
      updateDate()
    })

    step.onChange(() => {
      updateMug()
    })

    createWidget(widget.WIDGET_DELEGATE, {
      resume_call: () => {
        updateAll()
        startMugAnimation()
      },
      pause_call: () => {},
    })
  },

  onDestroy() {},
})
