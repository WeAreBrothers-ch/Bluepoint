import { useEffect, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { EmailDraft } from "../../lib/factures/draft.server";
import type { FacturesActionResult } from "../../lib/factures/list-item";
import { MESSAGE_MAX_LENGTH, SUBJECT_MAX_LENGTH } from "../../lib/factures/message-input";
import { mailtoUrl } from "../../lib/factures/mailto";
import { NNBSP } from "../../lib/format/typography";
import { DraftStatus, ModalButtons } from "./DraftStatus";
import { hideModal, type InvoiceDraftsControls } from "./useInvoiceDrafts";

/**
 * Fenêtre « Envoyer par e-mail » : objet et message déjà rédigés, modifiables avant l'envoi.
 * Envoi automatique configuré : l'app envoie, PDF joint. Sinon, comme pour WhatsApp, la messagerie de l'équipe
 * s'ouvre avec le message (et le lien du PDF) : l'envoi se fait dans la messagerie.
 */

interface EmailFormProps {
  readonly modalId: string;
  readonly invoiceId: string;
  readonly draft: EmailDraft;
  readonly fetcher: FetcherWithComponents<FacturesActionResult>;
}

interface MailboxFormProps {
  readonly modalId: string;
  readonly draft: EmailDraft;
  /** Note l'envoi dans l'historique de la facture. */
  readonly onOpened: () => void;
}

/** Sans envoi automatique : objet et message modifiables, puis ouverture de la messagerie. */
function MailboxForm({ modalId, draft, onOpened }: MailboxFormProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState(draft.text);
  const empty = subject.trim() === "" || text.trim() === "";
  const open = () => {
    onOpened();
    hideModal(modalId);
  };

  return (
    <>
      <s-stack direction="block" gap="base">
        <s-text color="subdued">{`À${NNBSP}: ${draft.to} — le lien du PDF est valable 14 jours.`}</s-text>
        <s-text-field label="Objet" value={subject} maxLength={SUBJECT_MAX_LENGTH} onInput={(event) => setSubject(event.currentTarget.value)} />
        <s-text-area label="Message" value={text} rows={14} maxLength={MESSAGE_MAX_LENGTH} onInput={(event) => setText(event.currentTarget.value)} />
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        icon="email"
        target="_blank"
        onClick={open}
        {...(empty ? { disabled: true } : { href: mailtoUrl(draft.to, subject.trim(), text.trim()) })}
      >
        Ouvrir ma messagerie
      </s-button>
      <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
        Annuler
      </s-button>
    </>
  );
}

/** Remonté (clé) à chaque nouveau brouillon : les champs repartent du texte proposé. */
function EmailForm({ modalId, invoiceId, draft, fetcher }: EmailFormProps) {
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState(draft.text);
  const sending = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "email";
  const send = () => fetcher.submit({ intent: "email", invoiceId, subject, text }, { method: "post", action: "/app/factures" });
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
  /** Note l'ouverture de la messagerie dans l'historique de la facture (envoi sans configuration automatique). */
  readonly onMailboxOpened: () => void;
}

export function InvoiceEmailModal({ modalId, invoiceId, drafts, fetcher, onMailboxOpened }: InvoiceEmailModalProps) {
  const draft = drafts.data?.ok ? drafts.data.drafts.email : null;
  const answer = fetcher.state === "idle" ? fetcher.data : undefined;
  const sent = answer?.ok === true && answer.invoiceId === invoiceId;

  // Se rejoue à chaque nouvelle réponse : un deuxième envoi ferme aussi la fenêtre.
  useEffect(() => {
    if (sent) hideModal(modalId);
  }, [answer, sent, modalId]);

  return (
    <s-modal id={modalId} heading="Envoyer par e-mail">
      {draft === null ? (
        <>
          <DraftStatus data={drafts.data} unavailable="L’envoi par e-mail n’est pas possible pour cette facture." />
          <ModalButtons modalId={modalId} primary="Envoyer" />
        </>
      ) : draft.mode === "messagerie" ? (
        <MailboxForm key={`${draft.subject}\n${draft.text}`} modalId={modalId} draft={draft} onOpened={onMailboxOpened} />
      ) : (
        <EmailForm key={`${draft.subject}\n${draft.text}`} modalId={modalId} invoiceId={invoiceId} draft={draft} fetcher={fetcher} />
      )}
    </s-modal>
  );
}
