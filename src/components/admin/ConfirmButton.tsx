"use client";

type ConfirmButtonProps = {
  children: React.ReactNode;
  message: string;
  className?: string;
  disabled?: boolean;
};

export function ConfirmButton({
  children,
  message,
  className,
  disabled,
}: ConfirmButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
