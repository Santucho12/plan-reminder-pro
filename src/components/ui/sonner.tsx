import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, Info, Loader2, TriangleAlert, XCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Avisos compactos: una píldora oscura con ícono de color, que se va sola. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={20}
      gap={8}
      duration={2600}
      icons={{
        success: <CheckCircle2 size={18} className="text-emerald-400" />,
        error: <XCircle size={18} className="text-rose-400" />,
        warning: <TriangleAlert size={18} className="text-amber-400" />,
        info: <Info size={18} className="text-sky-400" />,
        loading: <Loader2 size={18} className="text-slate-300 animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-fit max-w-[calc(100vw-2rem)] mx-auto rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white pl-4 pr-5 py-3 shadow-2xl shadow-slate-900/25 ring-1 ring-white/10",
          icon: "shrink-0 flex items-center",
          title: "text-sm font-semibold tracking-tight",
          description: "text-xs text-slate-300 mt-0.5",
          actionButton: "ml-2 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold",
          cancelButton: "ml-1 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
