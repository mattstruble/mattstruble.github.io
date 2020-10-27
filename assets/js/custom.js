
 
function loadClapCount() {
	var elements = $(".clap").toArray();
	var urls = elements.map(function (el) {
		return el.getAttribute("data-url")
	});
	
	$.ajax({
		url: "https://api.applause-button.com/get-multiple",
		method: "POST",
		data: JSON.stringify(urls),
		headers: {"Content-Type": "text/plain"},
		contentType: "text/plain"
	}).done(function (claps) {
		$(".clap").each(function () {
			var elem = $(this);
			var	url = elem.attr("data-url").replace(/^https?:\/\//, "");
			var clapCount = claps.find(function (c) {return c.url === url});
			if (clapCount && clapCount.claps > 0) {
				elem.css("display", "initial").find(".count").html(clapCount.claps)
			}
		})
	})
}

function updateClap(clapCount) {
	$('.clap').css({color: "#007bff", fill: "#007bff"}).find('.count').html(clapCount);
	$('#applause-button').find('.count').html(clapCount);
}

function getClap() {
	return Number($('.clap').find('.count').html());
}

function hideOverfill(elem) {
	if ( elem.offset().left-20< 0 ){
	  elem.addClass('hidden');
	  elem.children().addClass('none');
	} else {
	  elem.removeClass('hidden');
	  elem.children().removeClass('none');
	}
}

$(document).ready(function () {
	
	// https://stackoverflow.com/a/2911045
	$( 'a' ).not('.share-page a, .lightbox-link, .lightbox-image').each(function() {
	  if( location.hostname === this.hostname || !this.hostname.length ) {
		  //continue; //$(this).addClass('local');
	  } else {
		  $(this).addClass('external');
		  $(this).attr('target', '_blank');
	  }
	});

  /* selector */
  var postHeader = '.post > h2, .post > h3, .post > h4';
  var url = window.location;

// https://milanaryal.com.np/adding-hover-anchor-links-to-header-on-github-pages-using-jekyll/#jquery-snippet-to-add-anchor-links-to-jekyll-markdown-posts-header
  $(postHeader).filter('[id]').each(function () {
    var header      = $(this),
        headerID    = header.attr('id'),
        anchorClass = 'anchor no-underline',
        /* Octicons link SVG icon*/
        anchorIcon = '<svg class="icon icon-link no-underline" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z"></path></svg>';

    if (headerID !== null) {
      header.prepend($('<a />').addClass(anchorClass).attr({ 'aria-hidden': 'true', 'data-clipboard-text': url + '#' + headerID }).html(anchorIcon));
    }

    return this;
  });
  
  new ClipboardJS('.anchor');
  
  $.notify.addStyle('anchor', {
	 html: "<div><span data-notify-text/></div>"
  });
  
  $('.anchor').click(function (event) {
	  $.notify('Link copied to clipboard.', {
		 'position': 'top center',
		 'style': 'anchor',
		 'showDuration': 100,
		 'hideDuration': 100,
		 'autoHideDelay': 2000,
	  });
  });
  
  loadClapCount();
  
  $('#applause-button').on("clapped", function(event) {
	  updateClap(event.detail.clapCount);
  });
  
  var applauseWrapper = $('.applause-button-wrapper');
  var applauseTop = applauseWrapper.offset().top;
  
  $(window).scroll(function() {
	 var scrollPos = $(document).scrollTop();
	 if ( scrollPos > applauseTop-30) {
		applauseWrapper.addClass('applause-button-fixed');
	 } else {
		 applauseWrapper.removeClass('applause-button-fixed');
	 }
  });
  
  hideOverfill(applauseWrapper);
  $(window).resize(function() {
	  hideOverfill(applauseWrapper);
  });
  
  $('.share-page .clap').click(function (event) {
	$.ajax({
		url: "https://api.applause-button.com/update-claps?url=" + url,
		method: "POST",
		headers: {"Content-Type": "text/plain"},
		contentType: "text/plain"
	}).done(function (claps) {
		updateClap(getClap()+1);
	});
  });
});