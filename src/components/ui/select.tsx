"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type ItemEntry = { value: string; label: React.ReactNode; text: string; disabled?: boolean }

type SelectContextValue = {
  value: string | undefined
  setValue: (v: string) => void
  open: boolean
  setOpen: (o: boolean) => void
  query: string
  setQuery: (q: string) => void
  items: ItemEntry[]
  matches: (text: string) => boolean
  activeValue: string | null
  setActiveValue: (v: string | null) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("Select components must be used inside <Select>")
  return ctx
}

function childrenToText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(childrenToText).join(" ")
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode }
    return childrenToText(props.children)
  }
  return ""
}

function collectItems(node: React.ReactNode, out: ItemEntry[] = []): ItemEntry[] {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === SelectItem) {
      const props = child.props as {
        value: string
        children?: React.ReactNode
        textValue?: string
        disabled?: boolean
      }
      const text = props.textValue ?? childrenToText(props.children)
      out.push({ value: props.value, label: props.children, text, disabled: props.disabled })
      return
    }
    const props = child.props as { children?: React.ReactNode }
    if (props && props.children) collectItems(props.children, out)
  })
  return out
}

function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue)
  const value = valueProp !== undefined ? valueProp : internalValue
  const setValue = React.useCallback(
    (v: string) => {
      if (valueProp === undefined) setInternalValue(v)
      onValueChange?.(v)
    },
    [valueProp, onValueChange]
  )

  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const open = openProp !== undefined ? openProp : internalOpen

  const [query, setQuery] = React.useState("")
  const [activeValue, setActiveValue] = React.useState<string | null>(null)

  const setOpen = React.useCallback(
    (o: boolean) => {
      if (o) {
        setQuery("")
        setActiveValue(value ?? null)
      } else {
        setQuery("")
        setActiveValue(null)
      }
      if (openProp === undefined) setInternalOpen(o)
      onOpenChange?.(o)
    },
    [openProp, onOpenChange, value]
  )

  const items = React.useMemo(() => collectItems(children), [children])

  const matches = React.useCallback(
    (text: string) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return text.toLowerCase().includes(q)
    },
    [query]
  )

  const ctx = React.useMemo<SelectContextValue>(
    () => ({
      value,
      setValue,
      open,
      setOpen,
      query,
      setQuery,
      items,
      matches,
      activeValue,
      setActiveValue,
    }),
    [value, setValue, open, setOpen, query, items, matches, activeValue]
  )

  return (
    <SelectContext.Provider value={ctx}>
      {/* modal: sem isso, o react-remove-scroll do Dialog bloqueia o wheel no
          conteúdo portalado do popover (dá pra arrastar a barra, mas a roda
          do mouse não rola a lista). */}
      <PopoverPrimitive.Root modal open={open} onOpenChange={setOpen}>
        {children}
      </PopoverPrimitive.Root>
    </SelectContext.Provider>
  )
}

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="select-group" className={className} {...props} />
}

function SelectValue({
  placeholder,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { placeholder?: string }) {
  const { value, items } = useSelectContext()
  const current = items.find((i) => i.value === value)
  return (
    <span
      data-slot="select-value"
      className={cn("line-clamp-1 flex items-center gap-2", className)}
      {...props}
    >
      {current ? current.label : placeholder}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof PopoverPrimitive.Trigger>, "size"> & {
  size?: "sm" | "default"
}) {
  const { value, items } = useSelectContext()
  const isPlaceholder = !items.some((i) => i.value === value)
  return (
    <PopoverPrimitive.Trigger
      type="button"
      data-slot="select-trigger"
      data-size={size}
      data-placeholder={isPlaceholder ? "" : undefined}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 opacity-50" />
    </PopoverPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  align = "start",
  sideOffset = 4,
  searchPlaceholder = "Buscar…",
  emptyMessage = "Nada encontrado",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  searchPlaceholder?: string
  emptyMessage?: string
}) {
  const {
    query,
    setQuery,
    items,
    matches,
    setValue,
    setOpen,
    activeValue,
    setActiveValue,
  } = useSelectContext()

  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const filteredValues = React.useMemo(
    () => items.filter((i) => matches(i.text)).map((i) => i.value),
    [items, matches]
  )

  React.useEffect(() => {
    if (filteredValues.length === 0) {
      if (activeValue !== null) setActiveValue(null)
      return
    }
    if (!activeValue || !filteredValues.includes(activeValue)) {
      setActiveValue(filteredValues[0])
    }
  }, [filteredValues, activeValue, setActiveValue])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (filteredValues.length === 0) return
      const idx = activeValue ? filteredValues.indexOf(activeValue) : -1
      setActiveValue(filteredValues[(idx + 1) % filteredValues.length])
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (filteredValues.length === 0) return
      const idx = activeValue ? filteredValues.indexOf(activeValue) : 0
      setActiveValue(
        filteredValues[(idx - 1 + filteredValues.length) % filteredValues.length]
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeValue) {
        const item = items.find((i) => i.value === activeValue)
        if (item && !item.disabled) {
          setValue(activeValue)
          setOpen(false)
        }
      }
    } else if (e.key === "Home") {
      e.preventDefault()
      if (filteredValues[0]) setActiveValue(filteredValues[0])
    } else if (e.key === "End") {
      e.preventDefault()
      const last = filteredValues[filteredValues.length - 1]
      if (last) setActiveValue(last)
    }
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="select-content"
        align={align}
        sideOffset={sideOffset}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "z-50 min-w-[var(--radix-popover-trigger-width)] origin-(--radix-popover-content-transform-origin) overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="max-h-72 overflow-x-hidden overflow-y-auto overscroll-contain p-1">
          {filteredValues.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            children
          )}
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  textValue: _textValue,
  disabled,
  ...props
}: Omit<React.ComponentProps<"div">, "onSelect"> & {
  value: string
  textValue?: string
  disabled?: boolean
}) {
  void _textValue
  const {
    value: selected,
    setValue,
    setOpen,
    matches,
    activeValue,
    setActiveValue,
  } = useSelectContext()
  const ref = React.useRef<HTMLDivElement | null>(null)

  const text = React.useMemo(() => _textValue ?? childrenToText(children), [_textValue, children])
  const isSelected = selected === value
  const isActive = activeValue === value

  React.useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: "nearest" })
  }, [isActive])

  if (!matches(text)) return null

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isSelected}
      data-slot="select-item"
      data-state={isSelected ? "checked" : "unchecked"}
      data-active={isActive ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      onMouseEnter={() => {
        if (!disabled) setActiveValue(value)
      }}
      onClick={() => {
        if (disabled) return
        setValue(value)
        setOpen(false)
      }}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[active]:bg-accent data-[active]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        {isSelected ? <CheckIcon className="size-4" /> : null}
      </span>
      <span>{children}</span>
    </div>
  )
}

function SelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton() {
  return null
}

function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
