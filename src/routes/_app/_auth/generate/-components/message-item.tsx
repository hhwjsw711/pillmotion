import { Doc } from "@cvx/_generated/dataModel";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";

type Props = {
  message: Doc<"userMessages">;
  children: React.ReactNode;
  isUser: boolean;
};

export default function MessageItem({ message, children, isUser }: Props) {
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));

  if (!user) {
    return null;
  }

  return (
    <>
      {isUser && (
        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="text-sm text-gray-500">
            {new Date(message._creationTime).toLocaleDateString()}{" "}
            {new Date(message._creationTime).toLocaleTimeString()}
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}

      <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`flex gap-4 max-w-[95%] md:max-w-[85%] ${isUser && "flex-row-reverse"}`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700"} font-medium text-sm`}
          >
            {isUser ? (
              user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  className="h-full w-full rounded-full object-cover"
                  alt={user.username ?? user.email}
                />
              ) : (
                <div className="h-full w-full rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
              )
            ) : (
              <img
                src="/images/pill-logo.jpg"
                className="h-full w-full rounded-lg object-cover"
                alt="AI Avatar"
              />
            )}
          </div>

          <div
            className={`rounded-lg px-5 py-4 text-base ${
              isUser
                ? "bg-blue-600 text-white"
                : "bg-gray-100 border border-gray-200 text-gray-900"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
