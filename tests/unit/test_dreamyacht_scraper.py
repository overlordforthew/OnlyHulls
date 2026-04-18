import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scraper"))

import scrape_dreamyacht
from scrape_dreamyacht import extract_detail_images


class DreamYachtImageExtractionTest(unittest.TestCase):
    def test_extracts_gallery_images_without_theme_assets(self):
        html = """
        <img src="/app/themes/dys/assets/dist/theme/img/logo.svg">
        <img src="/app/uploads/2024/10/SUNNYMANGO_Dufour430-main-300x135.jpeg">
        <img src="/app/uploads/2024/10/SUNNYMANGO_Dufour430-main-1280x578.jpeg">
        <source srcset="/app/uploads/2024/10/SUNNYMANGO_Dufour430-cabin-300x300.jpeg 300w,
                        /app/uploads/2024/10/SUNNYMANGO_Dufour430-cabin-1024x1024.jpeg 1024w">
        <img data-src="/app/uploads/2024/10/SUNNYMANGO_Dufour430-helm.webp">
        """

        images = extract_detail_images(
            html,
            "https://www.dreamyachtsales.com/pre-owned-yachts/listings/sunny-mango/",
        )

        self.assertEqual(
            images,
            [
                "https://www.dreamyachtsales.com/app/uploads/2024/10/SUNNYMANGO_Dufour430-main-1280x578.jpeg",
                "https://www.dreamyachtsales.com/app/uploads/2024/10/SUNNYMANGO_Dufour430-cabin-1024x1024.jpeg",
                "https://www.dreamyachtsales.com/app/uploads/2024/10/SUNNYMANGO_Dufour430-helm.webp",
            ],
        )

    def test_limits_gallery_size(self):
        html = "\n".join(
            f'<img src="/app/uploads/2024/10/gallery-{index}-960x640.jpg">'
            for index in range(30)
        )

        images = extract_detail_images(
            html,
            "https://www.dreamyachtsales.com/pre-owned-yachts/listings/example/",
        )

        self.assertEqual(len(images), 24)

    def test_scrape_keeps_multiple_cards_from_one_page(self):
        original_fetch_html = scrape_dreamyacht.fetch_html
        original_fetch_detail_images = scrape_dreamyacht.fetch_detail_images

        page_html = """
        <article class="card">
          <a href="https://www.dreamyachtsales.com/pre-owned-yachts/listings/alpha/"
             class="card__link">Alpha 42</a>
          <img src="/app/uploads/alpha.jpg">
          <span>Location Martinique Build year 2017</span>
          <span>$123,000</span>
        </article>
        <article class="card">
          <a href="https://www.dreamyachtsales.com/pre-owned-yachts/listings/bravo/"
             class="card__link">Bravo 45</a>
          <img src="/app/uploads/bravo.jpg">
          <span>Location Guadeloupe Build year 2018</span>
          <span>$234,000</span>
        </article>
        """

        try:
            scrape_dreamyacht.fetch_html = lambda url, timeout=30: page_html
            scrape_dreamyacht.fetch_detail_images = lambda url: [f"{url}gallery.jpg"]

            boats = scrape_dreamyacht.scrape(2)

            self.assertEqual([boat["name"] for boat in boats], ["Alpha 42", "Bravo 45"])
            self.assertEqual(boats[0]["images"], ["https://www.dreamyachtsales.com/pre-owned-yachts/listings/alpha/gallery.jpg"])
            self.assertEqual(boats[1]["images"], ["https://www.dreamyachtsales.com/pre-owned-yachts/listings/bravo/gallery.jpg"])
        finally:
            scrape_dreamyacht.fetch_html = original_fetch_html
            scrape_dreamyacht.fetch_detail_images = original_fetch_detail_images


if __name__ == "__main__":
    unittest.main()
