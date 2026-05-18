import { createContext, useContext, type ReactNode } from 'react';

export type EditableWidget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'currency'
  | 'select';

export interface FieldClickEvent {
  path: string;
  value: unknown;
  widget: EditableWidget;
  rect: { top: number; left: number; width: number; height: number };
}

interface EditContextValue {
  editable: boolean;
  onFieldClick?: (e: FieldClickEvent) => void;
}

const EditContext = createContext<EditContextValue>({ editable: false });

export function useEditContext(): EditContextValue {
  return useContext(EditContext);
}

interface ProviderProps {
  editable: boolean;
  onFieldClick?: (e: FieldClickEvent) => void;
  children: ReactNode;
}

export function EditContextProvider({
  editable,
  onFieldClick,
  children,
}: ProviderProps) {
  return (
    <EditContext.Provider value={{ editable, onFieldClick }}>
      {children}
    </EditContext.Provider>
  );
}
