import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scraper"))

import scrape_moorings
from scrape_moorings import extract_detail_images


class MooringsImageExtractionTest(unittest.TestCase):
    def test_extracts_boatsgroup_gallery_images_without_site_assets(self):
        html = """
        <img src="https://res.cloudinary.com/enchanting/q_70/favicon.png">
        <img src="https://images.boatsgroup.com/resize/1/86/89/boat-0001_XLARGE.jpg?ts=1">
        <img data-src="https://images.boatsgroup.com/resize/1/86/89/boat-0002_XLARGE.jpg">
        <source srcset="https://images.boatsgroup.com/resize/1/86/89/boat-0003_SMALL.jpg 320w,
                        https://images.boatsgroup.com/resize/1/86/89/boat-0003_XLARGE.jpg 1280w">
        <img src="data:image/gif;base64,abc">
        """

        images = extract_detail_images(
            html,
            "https://www.mooringsbrokerage.com/used-boats/example",
        )

        self.assertEqual(
            images,
            [
                "https://images.boatsgroup.com/resize/1/86/89/boat-0001_XLARGE.jpg",
                "https://images.boatsgroup.com/resize/1/86/89/boat-0002_XLARGE.jpg",
                "https://images.boatsgroup.com/resize/1/86/89/boat-0003_XLARGE.jpg",
            ],
        )

    def test_scrape_page_replaces_card_image_with_detail_gallery(self):
        original_fetch_html = scrape_moorings.fetch_html
        original_fetch_detail_images = scrape_moorings.fetch_detail_images

        page_html = """
        <article class="cards__card">
          <a href="https://www.mooringsbrokerage.com/used-boats/2020-leopard-45-bahamas-example-123"></a>
          <h3 class="cards__title">2020 Leopard 45</h3>
          <div class="cards__price-amount">$450,000</div>
          <img src="https://images.boatsgroup.com/resize/card.jpg">
          <li class="cards__list-item">Abaco, Bahamas</li>
        </article>
        """

        try:
            scrape_moorings.fetch_html = lambda url: page_html
            scrape_moorings.fetch_detail_images = lambda url: [
                "https://images.boatsgroup.com/resize/detail-1.jpg",
                "https://images.boatsgroup.com/resize/detail-2.jpg",
            ]

            boats, has_next = scrape_moorings.scrape_page(
                "https://www.mooringsbrokerage.com/used-boats/sailing-catamarans-for-sale"
            )

            self.assertFalse(has_next)
            self.assertEqual(len(boats), 1)
            self.assertEqual(
                boats[0]["images"],
                [
                    "https://images.boatsgroup.com/resize/detail-1.jpg",
                    "https://images.boatsgroup.com/resize/detail-2.jpg",
                ],
            )
        finally:
            scrape_moorings.fetch_html = original_fetch_html
            scrape_moorings.fetch_detail_images = original_fetch_detail_images


if __name__ == "__main__":
    unittest.main()
