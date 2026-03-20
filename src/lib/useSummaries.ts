import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type SummaryStatus = "pending" | "processing" | "completed" | "failed";

export interface Summary {
    id: string;
    note_id: string;
    target_objective: string | null;
    content: string | null;
    scratchpad: string | null;
    status: SummaryStatus;
    created_at: string;
}

export const useSummaries = (noteId: string | null) => {
    const [summaries, setSummaries] = useState<Summary[]>([]);
    const [loading, setLoading] = useState(!!noteId);
    const [hasFetched, setHasFetched] = useState(false);

    const fetchSummaries = useCallback(async () => {
        if (!noteId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("summaries")
            .select("*")
            .eq("note_id", noteId)
            .order("created_at", { ascending: true });

        if (!error && data) {
            setSummaries(data);
        }
        setLoading(false);
        setHasFetched(true);
    }, [noteId]);

    useEffect(() => {
        setHasFetched(false); // Reset on note change
        fetchSummaries();

        if (!noteId) return;

        // Channel name includes random suffix to prevent collisions on fast mount/unmount
        const channelId = `summaries_${noteId}_${
            Math.random().toString(36).substring(7)
        }`;
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "summaries",
                    filter: `note_id=eq.${noteId}`,
                },
                (payload) => {
                    console.log(
                        "Realtime Summary Event:",
                        payload.eventType,
                        (payload.new as any)?.id || (payload.old as any)?.id,
                    );
                    if (
                        payload.eventType === "INSERT" ||
                        payload.eventType === "UPDATE"
                    ) {
                        const updatedItem = payload.new as Summary;
                        setSummaries((prev) => {
                            const exists = prev.find((s) =>
                                s.id === updatedItem.id
                            );
                            if (exists) {
                                return prev.map((s) =>
                                    s.id === updatedItem.id ? updatedItem : s
                                );
                            }
                            return [updatedItem, ...prev].sort((a, b) =>
                                new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime()
                            );
                        });
                    } else if (payload.eventType === "DELETE") {
                        setSummaries((prev) =>
                            prev.filter((s) => s.id !== (payload.old as any).id)
                        );
                    }
                },
            )
            .subscribe((status) => {
                console.log(`Summary Subscription (${noteId}):`, status);
            });

        return () => {
            console.log(`Cleaning up Summary Channel (${noteId})`);
            supabase.removeChannel(channel);
        };
    }, [noteId, fetchSummaries]);

    const generateSummary = async (objective?: string, customCreatedAt?: string) => {
        if (!noteId) return;

        // 🎯 Sincronizar el objetivo en la nota para que el motor Python lo detecte
        await supabase
            .from("notes")
            .update({
                focus_prompt: objective || null,
                ai_summary_status: "queued",
                updated_at: new Date().toISOString(),
            })
            .eq("id", noteId);

        const { data, error } = await supabase
            .from("summaries")
            .insert({
                note_id: noteId,
                target_objective: objective || null,
                status: "pending",
                created_at: customCreatedAt || new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating summary:", error);
            return null;
        }

        if (data) {
            // Optimistic Update: Add to local state immediately
            setSummaries((prev) => [data as Summary, ...prev]);
            console.log("Triggering AI for summary:", data.id);
        }

        return data;
    };

    const deleteSummary = async (summaryId: string) => {
        const { error } = await supabase.from("summaries").delete().eq(
            "id",
            summaryId,
        );
        if (error) console.error("Error deleting summary:", error);
    };

    const updateScratchpad = async (summaryId: string, text: string) => {
        const { error } = await supabase
            .from("summaries")
            .update({ scratchpad: text })
            .eq("id", summaryId);
        if (error) console.error("Error updating scratchpad:", error);
    };

    const updateSummaryMetadata = async (summaryId: string, updates: Partial<Summary>) => {
        const { error } = await supabase
            .from("summaries")
            .update(updates)
            .eq("id", summaryId);
        if (error) console.error("Error updating summary metadata:", error);
    };

    const updateSummaryContent = async (summaryId: string, text: string) => {
        const { error } = await supabase
            .from("summaries")
            .update({ content: text })
            .eq("id", summaryId);
        if (error) console.error("Error updating summary content:", error);
    };

    return {
        summaries,
        loading,
        generateSummary,
        deleteSummary,
        updateScratchpad,
        updateSummaryContent,
        updateSummaryMetadata,
        refresh: fetchSummaries,
        hasFetched,
    };
};
