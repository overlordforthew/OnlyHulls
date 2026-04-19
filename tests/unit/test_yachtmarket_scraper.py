import sys
import types
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scraper"))

if "scrapling" not in sys.modules:
    scrapling = types.ModuleType("scrapling")

    class DummyFetcher:
        def get(self, *args, **kwargs):
            raise RuntimeError("network fetch is not available in unit tests")

    scrapling.Fetcher = DummyFetcher
    sys.modules["scrapling"] = scrapling

from scrape_yachtmarket import extract_images, is_detail_page


class YachtMarketImageExtractionTest(unittest.TestCase):
    def test_extracts_main_and_thumbnail_gallery_images(self):
        html = """
        <div id="thumb0" class="darken gallery boatImageCLS">
          <img id="ContentPlaceHolder1_ContentPlaceHolder1_imgMainBoat"
               srcset="//cdnx.theyachtmarket.com/img/174173406/7/corbin-39-1981-0001.jpg 465w,
                       //cdnx.theyachtmarket.com/img/174173406/4/corbin-39-1981-0001.jpg 600w,
                       //cdnx.theyachtmarket.com/img/174173406/2/corbin-39-1981-0001.jpg 1000w"
               src="//cdnx.theyachtmarket.com/img/174173406/2/corbin-39-1981-0001.jpg" />
        </div>
        <span id="thumb1" class="darken gallery smallThumbCLS">
          <img src="//cdnx.theyachtmarket.com/img/174173407/12/corbin-39-1981-0002.jpg" />
        </span>
        <span id="thumb2" class="darken gallery smallThumbCLS">
          <img src="//cdnx.theyachtmarket.com/assets/images/noimage.gif" />
        </span>
        """

        self.assertEqual(
            extract_images(html),
            [
                "https://cdnx.theyachtmarket.com/img/174173406/2/corbin-39-1981-0001.jpg",
                "https://cdnx.theyachtmarket.com/img/174173407/2/corbin-39-1981-0002.jpg",
            ],
        )

    def test_ignores_placeholder_main_image_and_related_cards(self):
        html = """
        <img id="ContentPlaceHolder1_ContentPlaceHolder1_imgMainBoat"
             src="//cdnx.theyachtmarket.com/assets/images/noimage.gif"
             alt="No image" />
        <img class="img-responsive lazy"
             src="//cdnx.theyachtmarket.com/assets/images/noimage-219x218.gif"
             data-src="//cdnx.theyachtmarket.com/img/173026080/13/other-boat-0001.jpg" />
        """

        self.assertEqual(extract_images(html), [])

    def test_detects_redirected_search_page_as_not_detail(self):
        html = """
        <h1>Boats for sale</h1>
        <img class="img-responsive lazy"
             data-src="//cdnx.theyachtmarket.com/img/173026080/13/other-boat-0001.jpg" />
        """

        self.assertFalse(is_detail_page(html, "3108032"))
        self.assertEqual(extract_images(html), [])


if __name__ == "__main__":
    unittest.main()
