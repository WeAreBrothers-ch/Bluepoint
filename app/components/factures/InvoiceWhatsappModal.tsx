import { useState } from "react";
import type { InvoiceDrafts } from "../../lib/factures/draft.server";
import { MESSAGE_MAX_LENGTH } from "../../lib/factures/message-input";
import { whatsappUrl } from "../../lib/factures/phone";
import { NNBSP } from "../../lib/format/typography";
import { DraftStatus, ModalButtons } from "./DraftStatus";
import { hideModal, type InvoiceDraftsControls } from "./useInvoiceDrafts";

/**
 * Fenêtre « Envoyer par WhatsApp » : message déjà rédigé (avec le lien du PDF), modifiable,
 * puis ouverture de WhatsApp avec ce message. L'envoi lui-même se fait dans WhatsApp.
 */

type WhatsappDraft = NonNullable<InvoiceDrafts["whatsapp"]>;

interface WhatsappFormProps {
  readonly modalId: string;
  readonly draft: WhatsappDraft;
  readonly onOpened: () => void;
}

/** Remonté (clé) à chaque nouveau brouillon : le champ repart du texte proposé. */
function WhatsappForm({ modalId, draft, onOpened }: WhatsappFormProps) {
  const [text, setText] = useState(draft.text);
  const message = text.trim();
  const open = () => {
    onOpened();
    hideModal(modalId);
  };

  return (
    <>
      <s-stack direction="block" gap="base">
        <s-text color="subdued">{`À${NNBSP}: ${draft.phone} — le lien du PDF est valable 14 jours.`}</s-text>
        <s-text-area label="Message" value={text} rows={14} maxLength={MESSAGE_MAX_LENGTH} onInput={(event) => setText(event.currentTarget.value)} />
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        icon="chat"
        target="_blank"
        onClick={open}
        {...(message === "" ? { disabled: true } : { href: whatsappUrl(draft.phone, message) })}
      >
        Ouvrir WhatsApp
      </s-button>
      <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
        Annuler
      </s-button>
    </>
  );
}

interface InvoiceWhatsappModalProps {
  readonly modalId: string;
  readonly drafts: InvoiceDraftsControls;
  /** Note l'envoi dans l'historique de la facture. */
  readonly onOpened: () => void;
}

export function InvoiceWhatsappModal({ modalId, drafts, onOpened }: InvoiceWhatsappModalProps) {
  const draft = drafts.data?.ok ? drafts.data.drafts.whatsapp : null;
  return (
    <s-modal id={modalId} heading="Envoyer par WhatsApp">
      {draft === null ? (
        <>
          <DraftStatus data={drafts.data} unavailable="Aucun numéro de portable connu pour ce client." />
          <ModalButtons modalId={modalId} primary="Ouvrir WhatsApp" />
        </>
      ) : (
        <WhatsappForm key={draft.text} modalId={modalId} draft={draft} onOpened={onOpened} />
      )}
    </s-modal>
  );
}
