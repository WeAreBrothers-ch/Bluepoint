import { useEffect, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { InvoiceDrafts } from "../../lib/factures/draft.server";
import type { FacturesActionResult } from "../../lib/factures/list-item";
import { MESSAGE_MAX_LENGTH, SUBJECT_MAX_LENGTH } from "../../lib/factures/message-input";
import { NNBSP } from "../../lib/format/typography";
import { DraftStatus, ModalButtons } from "./DraftStatus";
import { hideModal, type InvoiceDraftsControls } from "./useInvoiceDrafts";

/** Fenêtre « Envoyer par e-mail » : objet et message déjà rédigés, modifiables avant l'envoi. */

type EmailDraft = NonNullable<InvoiceDrafts["email"]>;

interface EmailFormProps {
  readonly modalId: string;
  readonly invoiceId: string;
  readonly draft: EmailDraft;
  readonly fetcher: FetcherWithComponents<FacturesActionResult>;
}

/** Remonté (clé) à chaque nouveau brouillon : les champs repartent du texte proposé. */
function EmailForm({ modalId, invoiceId, draft, fetcher }: EmailFormProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState(draft.text);
  const sending = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "email";
  const send = () => fetcher.submit({ intent: "email", invoiceId, subject, text }, { method: "post" });
  const empty = subject.trim() === "" || text.trim() === "";

  return (
    <>
      <s-stack direction="block" gap="base">
        <s-text color="subdued">{`À${NNBSP}: ${draft.to} — le PDF est joint automatiquement.`}</s-text>
        <s-text-field label="Objet" value={subject} maxLength={SUBJECT_MAX_LENGTH} onInput={(event) => setSubject(event.currentTarget.value)} />
        <s-text-area label="Message" value={text} rows={14} maxLength={MESSAGE_MAX_LENGTH} onInput={(event) => setText(event.currentTarget.value)} />
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        icon="send"
        onClick={send}
        {...(sending ? { loading: true } : {})}
        {...(sending || empty ? { disabled: true } : {})}
      >
        Envoyer
      </s-button>
      <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
        Annuler
      </s-button>
    </>
  );
}

interface InvoiceEmailModalProps {
  readonly modalId: string;
  readonly invoiceId: string;
  readonly drafts: InvoiceDraftsControls;
  readonly fetcher: FetcherWithComponents<FacturesActionResult>;
}

export function InvoiceEmailModal({ modalId, invoiceId, drafts, fetcher }: InvoiceEmailModalProps) {
  const draft = drafts.data?.ok ? drafts.data.drafts.email : null;
  const sent = fetcher.state === "idle" && fetcher.data?.ok === true && fetcher.data.invoiceId === invoiceId;

  useEffect(() => {
    if (sent) hideModal(modalId);
  }, [sent, modalId]);

  return (
    <s-modal id={modalId} heading="Envoyer par e-mail">
      {draft === null ? (
        <>
          <DraftStatus data={drafts.data} unavailable="L’envoi par e-mail n’est pas possible pour cette facture." />
          <ModalButtons modalId={modalId} primary="Envoyer" />
        </>
      ) : (
        <EmailForm key={`${draft.subject}\n${draft.text}`} modalId={modalId} invoiceId={invoiceId} draft={draft} fetcher={fetcher} />
      )}
    </s-modal>
  );
}
