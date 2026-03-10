import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type SummaryStatus = "pending" | "processing" | "completed" | "failed";

export interface Summary {
    id: string;
    note_id: string;
    target_objective: string | null;
    content: string | null;
    status: SummaryStatus;
    created_at: string;
}

export const useSummaries = (noteId: string | null) => {
    const [summaries, setSummaries] = useState<Summary[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSummaries = useCallback(async () => {
        if (!noteId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("summaries")
            .select("*")
            .eq("note_id", noteId)
            .order("created_at", { ascending: false });

        if (!error && data) {
            setSummaries(data);
        }
        setLoading(false);
    }, [noteId]);

    useEffect(() => {
        fetchSummaries();

        if (!noteId) return;

        const channel = supabase
            .channel(`summaries_${noteId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "summaries",
                    filter: `note_id=eq.${noteId}`,
                },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        setSummaries(
                            (prev) => [payload.new as Summary, ...prev]
                        );
                    } else if (payload.eventType === "UPDATE") {
                        setSummaries((prev) =>
                            prev.map((s) =>
                                s.id === payload.new.id
                                    ? payload.new as Summary
                                    : s
                            )
                        );
                    } else if (payload.eventType === "DELETE") {
                        setSummaries((prev) =>
                            prev.filter((s) => s.id === payload.old.id)
                        );
                    }
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [noteId, fetchSummaries]);

    const generateSummary = async (objective?: string) => {
        if (!noteId) return;

        const { data, error } = await supabase
            .from("summaries")
            .insert({
                note_id: noteId,
                target_objective: objective || null,
                status: "pending",
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating summary:", error);
            return null;
        }

        // El procesamiento se dispara por DB Trigger o Edge Function
        // pero aquí devolvemos el registro creado
        // 🚀 Llamada a Edge Function para trigger de AI (Vibe Executed)
        if (data) {
            // Por ahora es un log, el backend debe implementar 'summarizeNote'
            console.log("Triggering AI for summary:", data.id);
            // await supabase.functions.invoke('summarizeNote', { body: { summaryId: data.id } });
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

    return {
        summaries,
        loading,
        generateSummary,
        deleteSummary,
        refresh: fetchSummaries,
    };
};
