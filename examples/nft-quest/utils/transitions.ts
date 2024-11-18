export const TransitionAlertScaleInOutTransition = {
  enterActiveClass: "transition ease duration-200",
  enterFromClass: "opacity-0 scale-95",
  enterToClass: "opacity-100 scale-100",
  leaveActiveClass: "transition ease duration-50",
  leaveFromClass: "opacity-100 scale-100",
  leaveToClass: "opacity-0 scale-95",
};

export const TransitionOpacity = {
  enterActiveClass: "transition",
  enterFromClass: "opacity-0",
  enterToClass: "opacity-100",
  leaveActiveClass: "transition",
  leaveFromClass: "opacity-100",
  leaveToClass: "opacity-0",
};

export const TransitionPrimaryButtonText = {
  enterActiveClass: "transition transform ease-in duration-150",
  enterFromClass: "-translate-y-3 opacity-0",
  enterToClass: "translate-y-0",
  leaveActiveClass: "transition transform ease-in duration-100",
  leaveFromClass: "translate-y-0 opacity-100",
  leaveToClass: "translate-y-3 opacity-0",
};

export const TransitionPageSlide = {
  next: {
    enterActiveClass: "transition transform ease duration-300",
    enterFromClass: "translate-x-10 opacity-0",
    enterToClass: "translate-x-0",
    leaveActiveClass: "transition transform ease duration-150",
    leaveFromClass: "translate-x-0 opacity-100",
    leaveToClass: "-translate-x-10 opacity-0",
  },
  prev: {
    enterActiveClass: "transition transform ease duration-300",
    enterFromClass: "-translate-x-10 opacity-0",
    enterToClass: "translate-x-0",
    leaveActiveClass: "transition transform ease duration-150",
    leaveFromClass: "translate-x-0 opacity-100",
    leaveToClass: "translate-x-10 opacity-0",
  },
} as const;
