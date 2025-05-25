$(function () {
  "use strict";
  feed();
});

/**
 * Initialize the masonry grid for the post feed
 * This is the main function that sets up the Edge theme masonry layout
 */
function feed() {
  "use strict";

  var grid = document.querySelector(".post-feed");
  if (!grid) return;
  var masonry;

  // Wait for all images to load before initializing Masonry
  // This ensures proper layout calculation
  imagesLoaded(grid, function () {
    masonry = new Masonry(grid, {
      itemSelector: ".grid-item",
      columnWidth: ".grid-sizer",
      stamp: ".related-title",
      hiddenStyle: { transform: "translateY(50px)", opacity: 0 },
      visibleStyle: { transform: "translateY(0)", opacity: 1 },
    });

    // When layout is complete, add the initialized class
    // This triggers the CSS transition to make the grid visible
    masonry.on("layoutComplete", function () {
      grid.classList.add("initialized");
    });

    masonry.layout();

    // Handle pagination with infinite scroll if enabled
    function callback(items, loadNextPage) {
      imagesLoaded(items, function (loaded) {
        masonry.appended(items);
        masonry.layout();
        loaded.elements.forEach(function (item) {
          item.style.visibility = "visible";
        });
        loadNextPage();
      });
    }

    pagination(true, callback, true);
  });

  // Initialize PhotoSwipe lightbox for the images
  pswp(".post-feed", ".post", ".post-lightbox", ".post-caption", false);
}

/**
 * Initialize PhotoSwipe lightbox
 * @param {string} container - The container selector
 * @param {string} element - The element selector
 * @param {string} trigger - The trigger selector
 * @param {string} caption - The caption selector
 * @param {boolean} isGallery - Whether this is a gallery
 */
function pswp(container, element, trigger, caption, isGallery) {
  var parseThumbnailElements = function (el) {
    var items = [],
      gridEl,
      linkEl,
      item;

    $(el)
      .find(element)
      .each(function (i, v) {
        gridEl = $(v);
        linkEl = gridEl.find(trigger);

        item = {
          src: isGallery ? gridEl.find("img").attr("src") : linkEl.attr("href"),
          w: 0,
          h: 0,
        };

        if (caption && gridEl.find(caption).length) {
          item.title = gridEl.find(caption).html();
        }

        items.push(item);
      });

    return items;
  };

  var openPhotoSwipe = function (index, galleryElement) {
    var pswpElement = document.querySelectorAll(".pswp")[0],
      gallery,
      options,
      items;

    items = parseThumbnailElements(galleryElement);

    options = {
      closeOnScroll: false,
      history: false,
      index: index,
      shareEl: false,
      showAnimationDuration: 0,
      showHideOpacity: true,
    };

    gallery = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, options);
    gallery.listen("gettingData", function (index, item) {
      if (item.w < 1 || item.h < 1) {
        // unknown size
        var img = new Image();
        img.onload = function () {
          // will get size after load
          item.w = this.width; // set image width
          item.h = this.height; // set image height
          gallery.updateSize(true); // reinit Items
        };
        img.src = item.src; // let's download image
      }
    });
    gallery.init();
  };

  var onThumbnailsClick = function (e) {
    e.preventDefault();

    var index = $(e.target)
      .closest(container)
      .find(element)
      .index($(e.target).closest(element));
    var clickedGallery = $(e.target).closest(container);

    openPhotoSwipe(index, clickedGallery[0]);

    return false;
  };

  $(container).on("click", trigger, function (e) {
    onThumbnailsClick(e);
  });
}

/**
 * Handle infinite scroll pagination
 * @param {boolean} useScroll - Whether to use scroll-based loading
 * @param {function} callback - Callback function when new items are loaded
 * @param {boolean} visibilityHidden - Whether new items should be initially hidden
 */
function pagination(useScroll, callback, visibilityHidden = false) {
  let feedContainer = document.querySelector(".gh-feed");
  if (!feedContainer) return;

  let isLoading = false;
  let sentinel =
    feedContainer.nextElementSibling ||
    feedContainer.parentElement.nextElementSibling ||
    document.querySelector(".gh-foot");
  let loadMoreBtn = document.querySelector(".gh-loadmore");

  // Remove load more button if there's no next page
  if (!document.querySelector("link[rel=next]") && loadMoreBtn) {
    loadMoreBtn.remove();
  }

  // Function to load more posts
  async function loadMorePosts() {
    let nextLink = document.querySelector("link[rel=next]");
    if (nextLink) {
      try {
        // Fetch the next page
        const response = await fetch(nextLink.href);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Get new posts
        const newPosts = doc.querySelectorAll(
          ".gh-feed:not(.gh-featured):not(.gh-related) > *"
        );

        // Create a document fragment to hold the new posts
        let fragment = document.createDocumentFragment();
        let items = [];

        // Add each new post to the fragment
        newPosts.forEach(function (post) {
          let importedPost = document.importNode(post, true);
          if (visibilityHidden) {
            importedPost.style.visibility = "hidden";
          }
          fragment.appendChild(importedPost);
          items.push(importedPost);
        });

        // Add the fragment to the feed
        feedContainer.appendChild(fragment);

        // Call the callback if provided
        if (callback) {
          callback(items, checkSentinel);
        }

        // Update the next link
        const newNextLink = doc.querySelector("link[rel=next]");
        if (newNextLink && newNextLink.href) {
          nextLink.href = newNextLink.href;
        } else {
          // Remove next link if there are no more pages
          nextLink.remove();
          if (loadMoreBtn) {
            loadMoreBtn.remove();
          }
        }
      } catch (error) {
        // Handle errors
        nextLink.remove();
        if (loadMoreBtn) {
          loadMoreBtn.remove();
        }
        throw error;
      }
    }
  }

  // Function to check if the sentinel is visible and load more posts
  async function checkSentinel() {
    if (
      sentinel.getBoundingClientRect().top <= window.innerHeight &&
      document.querySelector("link[rel=next]")
    ) {
      await loadMorePosts();
    }
  }

  // Set up the intersection observer to detect when the sentinel is visible
  let observer = new IntersectionObserver(async function (entries) {
    if (!isLoading) {
      isLoading = true;

      if (entries[0].isIntersecting) {
        if (visibilityHidden) {
          await loadMorePosts();
        } else {
          // Keep loading posts until the sentinel is no longer visible
          while (
            sentinel.getBoundingClientRect().top <= window.innerHeight &&
            document.querySelector("link[rel=next]")
          ) {
            await loadMorePosts();
          }
        }
      }

      isLoading = false;

      // If there are no more posts, disconnect the observer
      if (!document.querySelector("link[rel=next]")) {
        observer.disconnect();
      }
    }
  });

  // Observe the sentinel if using scroll-based loading
  if (useScroll) {
    observer.observe(sentinel);
  } else if (loadMoreBtn) {
    // Set up click event for load more button
    loadMoreBtn.addEventListener("click", loadMorePosts);
  }
}
