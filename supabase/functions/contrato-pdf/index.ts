/**
 * Entrega o PDF de um contrato para quem tem o link de assinatura.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O cliente que assina não tem conta no sistema, e o bucket `contratos` é
 * privado. A saída óbvia — dar ao papel `anon` permissão de leitura sobre os
 * PDFs de contrato — não serve: a listagem do Storage se apoia na MESMA
 * permissão de select, então qualquer um com a chave pública do projeto
 * conseguiria enumerar os arquivos e baixar contratos alheios, com nome,
 * CPF/CNPJ, telefone e assinatura de outras pessoas dentro.
 *
 * Por isso o anônimo não fala com o Storage. Ele pede o arquivo aqui, com o
 * token do seu contrato; esta função valida o token no banco e devolve os
 * bytes. Sem token válido não há resposta, e não há nada para enumerar.
 *
 * Deploy: supabase functions deploy contrato-pdf --no-verify-jwt
 * (sem verificação de JWT porque quem chama é o cliente, sem sessão; a
 * autorização é o próprio token do contrato.)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const erro = (status: number, mensagem: string) =>
  new Response(JSON.stringify({ error: mensagem }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return erro(405, "método não suportado");

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const tipo = url.searchParams.get("tipo") === "assinado" ? "assinado" : "preparado";

  // O formato do token é conferido antes de qualquer consulta.
  if (!/^[0-9a-f]{48}$/.test(token)) return erro(400, "token inválido");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await admin
    .from("show_contracts")
    .select("storage_key, status, signed_pdf_path")
    .eq("public_token", token)
    .neq("status", "cancelado")
    .maybeSingle();

  if (error || !data) return erro(404, "contrato não encontrado");
  if (tipo === "assinado" && !data.signed_pdf_path) {
    return erro(404, "o contrato ainda não foi assinado pelas duas partes");
  }

  const path = `${tipo}/${data.storage_key}.pdf`;
  const file = await admin.storage.from("contratos").download(path);
  if (file.error || !file.data) return erro(404, "arquivo indisponível");

  return new Response(file.data, {
    headers: {
      ...CORS,
      "Content-Type": "application/pdf",
      // Privado: é um documento com dados pessoais, não pode ficar em cache
      // compartilhado no caminho.
      "Cache-Control": "private, max-age=60",
    },
  });
});
