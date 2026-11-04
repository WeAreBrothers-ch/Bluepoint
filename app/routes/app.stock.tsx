import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { StockPageView } from "../components/stock/StockPageView";
import type { StockActionResult } from "../lib/stock/stock";
import type { NewWineResult } from "../lib/stock/new-wine";
import { handleNewWine } from "../lib/stock/new-wine.server";
import type { PhotoResult } from "../lib/stock/photo";
import { handlePhotoChange } from "../lib/stock/photo.server";
import type { PriceResult } from "../lib/stock/price";
import { handlePriceChange } from "../lib/stock/price.server";
import { handleStockAction, loadStockPage, type StockPageData } from "../lib/stock/stock.server";

/** Stock : combien de bouteilles il reste de chaque vin ; ajouter du vin reçu ; corriger après un comptage ; nouveau vin. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<StockPageData> => {
  const { admin } = await authenticate.admin(request);
  return loadStockPage(admin);
};

export const action = async ({ request }: ActionFunctionArgs): Promise<StockActionResult | NewWineResult | PhotoResult | PriceResult> => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "nouveau_vin") return handleNewWine(admin, form);
  if (intent === "photo") return handlePhotoChange(admin, form);
  if (intent === "prix") return handlePriceChange(admin, form);
  return handleStockAction(admin, form);
};

export default function StockPage() {
  const data = useLoaderData<typeof loader>();
  return <StockPageView data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
