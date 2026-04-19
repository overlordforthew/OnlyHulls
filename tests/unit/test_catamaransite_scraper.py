import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scraper"))

import scrape_catamaransite
from scrape_catamaransite import extract_detail_images


class CatamaranSiteImageExtractionTest(unittest.TestCase):
    def test_extracts_gallery_images_without_theme_assets(self):
        html = """
        <img src="https://www.yachtsite.com/wp-content/uploads/2020/08/cropped-logo2020-1-sm-270x270.png">
        <img src="https://www.yachtsite.com/wp-content/uploads/2025/01/front-view-300x225.jpg"
             srcset="https://www.yachtsite.com/wp-content/uploads/2025/01/front-view-300x225.jpg 300w,
                     https://www.yachtsite.com/wp-content/uploads/2025/01/front-view-1024x768.jpg 1024w,
                     https://www.yachtsite.com/wp-content/uploads/2025/01/front-view.jpg 1600w">
        <img data-src="/wp-content/uploads/2025/01/salon-700x525.jpg">
        <img srcset="https://www.yachtsite.com/wp-content/uploads/2025/01/helm-700x525.webp 700w,
                     https://www.yachtsite.com/wp-content/uploads/2025/01/helm-scaled.webp 1600w">
        <img src="data:image/gif;base64,abc">
        """

        images = extract_detail_images(
            html,
            "https://www.catamaransite.com/yachts-for-sale/fountaine-pajot-48-custom/",
        )

        self.assertEqual(
            images,
            [
                "https://www.yachtsite.com/wp-content/uploads/2025/01/front-view.jpg",
                "https://www.catamaransite.com/wp-content/uploads/2025/01/salon-700x525.jpg",
                "https://www.yachtsite.com/wp-content/uploads/2025/01/helm-scaled.webp",
            ],
        )

    def test_card_parser_replaces_card_image_with_detail_gallery(self):
        original_fetch_detail_fallback = scrape_catamaransite.fetch_detail_fallback
        article = """
        <article class="card">
          <a href="https://www.catamaransite.com/yachts-for-sale/example-cat/" title="Example Cat 42"></a>
          <img src="https://www.yachtsite.com/wp-content/uploads/2025/01/card.jpg">
          <span>Location Florida Asking $123,000</span>
          <span>Example Cat 42 is a 2004 cruising catamaran</span>
        </article>
        """

        try:
            scrape_catamaransite.fetch_detail_fallback = lambda url: {
                "images": [
                    "https://www.yachtsite.com/wp-content/uploads/2025/01/detail-1.jpg",
                    "https://www.yachtsite.com/wp-content/uploads/2025/01/detail-2.jpg",
                ]
            }

            boat = scrape_catamaransite.parse_card(article)

            self.assertIsNotNone(boat)
            self.assertEqual(
                boat["images"],
                [
                    "https://www.yachtsite.com/wp-content/uploads/2025/01/detail-1.jpg",
                    "https://www.yachtsite.com/wp-content/uploads/2025/01/detail-2.jpg",
                ],
            )
        finally:
            scrape_catamaransite.fetch_detail_fallback = original_fetch_detail_fallback


if __name__ == "__main__":
    unittest.main()
