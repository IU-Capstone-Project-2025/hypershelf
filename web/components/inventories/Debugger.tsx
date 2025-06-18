"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { JsonViewer, type JsonViewerProps } from "../ui/json-viewer";

type DebuggerProps = {
  open: boolean;
  setIsOpen: (isOpen: boolean) => void;
  children?: React.ReactNode;
} & JsonViewerProps;

export function Debugger(props: DebuggerProps) {
  return (
    <AlertDialog open={props.open} onOpenChange={props.setIsOpen}>
      <AlertDialogContent className="max-h-[60vh] !max-w-2xl overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Debug Information</AlertDialogTitle>
        </AlertDialogHeader>
        <JsonViewer {...props} className="text-xs" />
        <AlertDialogFooter>
          {props.children}
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
