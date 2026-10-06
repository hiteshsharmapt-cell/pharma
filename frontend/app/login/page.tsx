"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuth, homeFor, User } from "@/lib/auth";
import { Alert, Button, Input } from "@/components/ui";

const schema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Password is required") });
type Form = z.infer<typeof schema>;

export default function Login() {
  const router = useRouter(); const { setSession } = useAuth(); const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = async (d: Form) => {
    setError("");
    try {
      const r = await api<{ access_token: string; user: User }>("/api/auth/login", { method: "POST", json: d });
      setSession(r.access_token, r.user); router.push(homeFor(r.user.role));
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Login</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border bg-white p-6">
        {error && <Alert>{error}</Alert>}
        <Input label="Email" type="email" {...register("email")} error={errors.email?.message} />
        <Input label="Password" type="password" {...register("password")} error={errors.password?.message} />
        <Button type="submit" loading={isSubmitting} className="w-full">Login</Button>
      </form>
      <p className="mt-4 text-center text-sm">New supplier? <Link href="/register" className="font-semibold text-brand-600">Register</Link></p>
    </div>);
}
