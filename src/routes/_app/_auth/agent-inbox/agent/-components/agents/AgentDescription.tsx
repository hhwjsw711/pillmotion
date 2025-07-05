import * as React from "react";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { EditableText, EditableTextHandle } from "@/ui/editable-text";
import { Pencil } from "lucide-react";
import { Doc } from "~/convex/_generated/dataModel";
import { UseMutationResult } from "@tanstack/react-query";

interface AgentDescriptionProps {
  agent: Doc<"agents">;
  updateAgent: UseMutationResult<any, Error, any, unknown>;
}

export const AgentDescription: React.FC<AgentDescriptionProps> = ({
  agent,
  updateAgent,
}) => {
  const descriptionEditRef = React.useRef<EditableTextHandle>(null);

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">About</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => descriptionEditRef.current?.startEditing()}
          disabled={updateAgent.isPending}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <EditableText
        value={agent.description}
        editRef={descriptionEditRef}
        onSave={async (newDescription) => {
          updateAgent.mutate({
            agentId: agent._id,
            name: agent.name,
            description: newDescription,
            personality: agent.personality,
            tools: agent.tools,
          });
        }}
      />
    </Card>
  );
};
