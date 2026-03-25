import Link from 'next/link'
import { resetPasswordRequest } from '../actions'

export const metadata = {
  title: 'Forgot Password - NutriSnap AI',
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const { message } = await searchParams

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 m-auto min-h-screen">
      <Link
        href="/login"
        className="absolute left-8 top-8 py-2 px-4 rounded-md no-underline text-emerald-900 bg-white shadow hover:bg-emerald-50 flex items-center group text-sm font-medium transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Login
      </Link>

      <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-white/50 w-full mt-24">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">Reset Password</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Enter your email address and we will send you a link to reset your password.
        </p>

        <form className="flex-1 flex flex-col w-full justify-center gap-4 text-slate-700">
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1" htmlFor="email">
              Email
            </label>
            <input
              className="rounded-lg px-4 py-3 bg-white border border-slate-200 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>
          
          <div className="mt-2 flex flex-col gap-3">
            <button
              formAction={resetPasswordRequest}
              className="bg-emerald-600 hover:bg-emerald-700 transition-colors rounded-lg px-4 py-3 text-white font-semibold text-lg"
            >
              Send Reset Link
            </button>
          </div>
          
          {message && (
            <p className="mt-4 p-4 bg-emerald-50 text-emerald-800 text-center rounded-lg border border-emerald-100 font-medium">
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
