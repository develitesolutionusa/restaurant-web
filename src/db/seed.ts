import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { menuItems as seedMenu } from "../data/menu";
import { reviews as seedReviews } from "../data/reviews";
import { galleryImages as seedGallery } from "../data/gallery";
import { eventPackages as seedEvents } from "../data/events";

config({ path: ".env.local" });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

async function seed() {
  for (const item of seedMenu) {
    await db.insert(schema.menuItems).values({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
      popular: item.popular ?? false,
      dietary: item.dietary ?? null,
    });
  }

  for (const review of seedReviews) {
    await db.insert(schema.reviews).values({
      name: review.name,
      rating: review.rating,
      text: review.text,
      date: review.date,
      avatar: review.avatar,
    });
  }

  for (const img of seedGallery) {
    await db.insert(schema.galleryImages).values({
      src: img.src,
      alt: img.alt,
      category: img.category,
    });
  }

  for (const pkg of seedEvents) {
    await db.insert(schema.eventPackages).values({
      title: pkg.title,
      description: pkg.description,
      capacity: pkg.capacity,
      price: pkg.price,
      image: pkg.image,
      features: pkg.features,
    });
  }

  console.log("Seed complete");
}

seed().catch(console.error);
